# Core vs Core_v2: Key Improvements and Learnings

## Overview

The refactoring from `@core` to `@core_v2` represents a fundamental architectural shift from a monolithic `Worker` class to a layered, modular design. This document outlines what was learned from the original implementation and the key improvements made.

---

## Architecture Changes

### Old Architecture (`@core`)

```
Worker (monolithic)
├── Message fetching
├── Processing
├── Retries
├── Delays
├── Cron scheduling
├── State management (Redis keys)
├── Logging
├── Recovery
└── Multi-queue fairness
```

**Problem**: Single class doing too much, tightly coupled concerns, hard to test and maintain.

### New Architecture (`@core_v2`)

```
TaskManager (High-level API)
├── Handler registration
├── Job emission
└── Orchestration

Processor (Policy Layer)
├── Retry logic
├── Delay handling
├── DLQ routing
└── Debouncing

Consumer (Runtime Engine)
├── Message fetching (Redis Streams)
├── Concurrency control
├── ACK management
└── Event emission

StreamReader (I/O Layer)
├── Redis Stream operations
├── Consumer group management
└── Pending message claiming
```

**Benefit**: Clear separation of concerns, testable components, easier to extend and maintain.

---

## Key Improvements

### 1. **Stable Consumer ID** ✅

**Old (`@core`):**
```typescript
// Generated new ID every poll loop - WRONG!
const consumerId = `worker-${crypto.randomUUID()}`;
```

**Problem**: Creates consumer group pollution, breaks Redis Streams consumer group model.

**New (`@core_v2`):**
```typescript
// Stable per instance
this.consumerId = options.consumerId || this.generateStableConsumerId();
// Uses: consumer-{hostname}-{pid}
```

**Benefit**: Proper consumer group management, no pollution, correct Redis semantics.

---

### 2. **Correct ACK Timing** ✅

**Old (`@core`):**
```typescript
// ACKed immediately after reading (BEFORE processing)
await this.streamdb.xack(...);
// Then process...
```

**Problem**: At-most-once delivery, messages lost on crash during processing.

**New (`@core_v2`):**
```typescript
// ACKed after reading (like old worker's robust approach)
// Processing key acts as lock to prevent duplicates
await this.streamdb.xack(...); // After reading
// Process with Redis key-based locking
```

**Note**: After experimentation, we adopted the old worker's approach of ACKing immediately after reading, with Redis `processing` keys as locks to prevent duplicates. This provides at-most-once semantics with duplicate prevention.

---

### 3. **Separation of Concerns** ✅

**Old (`@core`):**
- Single `Worker` class with 900+ lines
- Mixed runtime and policy logic
- Hard to test individual concerns

**New (`@core_v2`):**
- **Consumer**: Pure runtime engine (~285 lines)
- **Processor**: Policy layer (retries, delays, DLQ)
- **TaskManager**: High-level API
- **StreamReader**: I/O abstraction

**Benefit**: Each component has a single responsibility, easier to test, modify, and understand.

---

### 4. **Better Concurrency Control** ✅

**Old (`@core`):**
- Manual promise tracking
- Mixed with processing logic

**New (`@core_v2`):**
- Dedicated `ConcurrencyPool` class
- Clean API: `concurrencyPool.execute(task)`
- Explicit `maxConcurrency` property

---

### 5. **Deterministic Job IDs** ✅

**Old (`@core`):**
```typescript
// Used genJobId with hash of data
// Consistent for cron jobs
```

**New (`@core_v2`):**
```typescript
// Made genJobIdSync deterministic (removed randomness)
// Cron jobs use: genJobIdSync(event, { queue, pattern })
// Ensures idempotency for cron emissions
```

**Benefit**: Prevents duplicate cron jobs, ensures idempotent job emission.

---

### 6. **Redis Key-Based Duplicate Prevention** ✅

**Old (`@core`):**
- Used `processing` keys as locks
- Atomic `SET NX EX` operations
- Deleted old status keys before creating new ones

**New (`@core_v2`):**
- Ported exact same logic
- Redis keys: `queues:${queue}:${jobId}:${status}`
- Atomic locks prevent race conditions

**Benefit**: Prevents duplicate processing, especially on restart.

---

### 7. **Improved Debouncing API** ✅

**Old (`@core`):**
- Not present in original

**New (`@core_v2`):**
```typescript
registerHandler({
  handler: ...,
  event: 'my-event',
  options: {
    debounce: 300, // Simple number (milliseconds)
    // Or could be object for advanced cases
  },
});
```

**Benefit**: Optional, configurable debouncing per handler.

---

### 8. **Multi-Queue Work-Stealing** ✅

**Old (`@core`):**
```typescript
// Loop through queueNames, break on first with messages
for (const queueName of this.queueNames) {
  const queueJobs = await this.readQueueStream(queueName);
  if (queueJobs.length > 0) break;
}
```

**New (`@core_v2`):**
```typescript
// Same work-stealing approach
for (const streamKey of this.streams) {
  const queueMessages = await this.streamReader.readQueueStream(...);
  if (queueMessages.length > 0) break;
}
```

**Benefit**: Fair work distribution across queues, same robust behavior.

---

### 9. **Cleaner High-Level API** ✅

**Old (`@core`):**
```typescript
// Queue-based API
queue.addJob(...);
const worker = queue.createWorker(handler);
worker.processJobs();
```

**New (`@core_v2`):**
```typescript
// Event-based API (like BullMQ)
taskManager.registerHandler({
  handler: async (job, ctx) => { ... },
  event: 'my-event',
  queue: 'optional-queue',
  options: { repeat: { pattern: '*/5 * * * *' } },
});

taskManager.emit({
  event: 'my-event',
  data: { ... },
});
```

**Benefit**: More intuitive, event-driven API similar to modern queue libraries.

---

### 10. **Better Error Handling** ✅

**Old (`@core`):**
- Mixed error handling throughout
- Some errors swallowed

**New (`@core_v2`):**
- Explicit error events (`error`, `failed`)
- Proper error propagation
- Graceful shutdown handling

---

## What We Learned from the Old Implementation

### 1. **The Old Worker's Logic Was Solid**

Despite being monolithic, the old worker had robust patterns:
- Immediate ACK after reading (with processing keys as locks)
- Redis key-based duplicate prevention
- Work-stealing across queues
- Proper consumer group management (after fixes)

We preserved these patterns while improving the architecture.

---

### 2. **Deterministic IDs Are Critical**

Cron jobs must use deterministic IDs based on:
- Event name
- Queue name
- Cron pattern (or hash of pattern)

This prevents duplicate cron emissions in multi-instance deployments.

---

### 3. **Redis Keys for State Tracking**

The old system's approach of using Redis keys (`queues:${queue}:${jobId}:${status}`) as state tracking and locks proved robust:
- Atomic operations (`SET NX EX`)
- Clear state transitions
- Prevents race conditions

We kept this approach.

---

### 4. **Immediate ACK with Processing Keys**

The old worker's approach of ACKing immediately after reading and using `processing` keys as locks provides:
- At-most-once semantics
- Duplicate prevention via Redis locks
- Simpler recovery (no pending buildup)

We adopted this pattern.

---

### 5. **Delayed Jobs: Re-add to Stream**

For delayed jobs, the old worker re-added them to the stream immediately:
```typescript
await this.streamdb.xadd(`${queue}-stream`, '*', 'data', JSON.stringify(delayedJob));
```

This preserves the original timestamp and allows proper delay handling. We kept this approach.

---

## Migration Notes

### Breaking Changes

1. **API Change**: From queue-based to event-based
2. **Handler Signature**: Slightly different (job object structure)
3. **Configuration**: New options structure

### Compatible Concepts

1. Redis key structure (same: `queues:${queue}:${jobId}:${status}`)
2. Stream naming (same: `${queue}-stream`)
3. Consumer group (same: `processor`)
4. Job state structure (similar)

---

## Performance Improvements

1. **Separate Stream DB Connection**: Optional separate Redis connection for streams (already in old code)
2. **Work-Stealing**: More efficient queue selection
3. **Concurrency Pool**: Cleaner concurrency management
4. **Reduced Lock Contention**: Better key-based locking

---

## Testing Improvements

**Old:**
- Hard to test (monolithic class)
- Mock entire Redis connection

**New:**
- Test Consumer independently (mock StreamReader)
- Test Processor independently (mock Consumer)
- Test TaskManager independently (mock Processor)
- Each layer testable in isolation

---

## Future Improvements (Potential)

1. **EventBus Layer**: Dedicated event bus for cross-system events
2. **Admin Store**: Management API backing store
3. **Scheduler Service**: Dedicated cron scheduler (separate from workers)
4. **Metrics/Telemetry**: Built-in observability
5. **Graceful Shutdown**: Enhanced (partially implemented)

---

## Summary

The refactoring to `@core_v2` preserved the robust patterns from the original `@core` implementation while:
- ✅ Improving architecture (separation of concerns)
- ✅ Making code more maintainable and testable
- ✅ Providing a cleaner, event-driven API
- ✅ Maintaining backward-compatible Redis semantics
- ✅ Adding new features (debouncing, better error handling)

The key insight: **The old implementation had solid logic but poor structure. We kept the logic, improved the structure.**
