# Rebuild Complete - Unified Worker Pool Architecture

## ✅ What Was Changed

### 1. **Unified Worker Pool** ✅
- Created `UnifiedWorkerPool` class
- Workers are now queue-agnostic
- Workers can process jobs from ANY queue (work stealing)
- Single processing server instead of multiple

### 2. **Removed `addJob`** ✅
- Replaced with `enqueue()` - for single queue
- Added `publish()` - for broadcasting to multiple queues

### 3. **Type-Safe Registration** ✅
- `registerJob()` now uses `Task<D, T>` type
- Full type safety for job data and context

### 4. **Work Stealing** ✅
- Workers poll from all queues in round-robin
- If a queue is empty, immediately try next queue
- Workers take more jobs when cores are available

---

## New API

### Before (v0.78.0)
```typescript
const tempotask = QueueManager.init({
  db,
  ctx: contextApp,
  concurrency: 1,
  options: { maxJobsPerStatus: 10 }
});

tempotask.registerJob(job);
tempotask.processJobs(); // Starts workers per queue
tempotask.addJob({ name: 'job', queue: 'queue', data: {} });
```

### After (v1.0)
```typescript
const tempotask = QueueManager.init({
  db,
  ctx: contextApp,
  concurrency: 10, // Total workers across ALL queues
  options: { maxJobsPerStatus: 10 }
});

// Type-safe registration
tempotask.registerJob<TaskData>({
  name: 'job',
  queue: 'queue',
  handler: async (job, ctx) => {
    // job.data is typed as TaskData
    // ctx has enqueue and publish
  }
});

await tempotask.start(); // Starts unified worker pool

// Enqueue to single queue
tempotask.enqueue({
  name: 'job',
  queue: 'queue',
  data: { /* typed data */ }
});

// Publish to multiple queues (broadcast)
tempotask.publish({
  name: 'event',
  queues: ['queue1', 'queue2', 'queue3'],
  data: { /* typed data */ }
});
```

### In Job Handlers
```typescript
// Context now has enqueue and publish
ctx.enqueue({
  name: 'child-job',
  queue: 'queue',
  data: { /* typed */ }
});

ctx.publish({
  name: 'event',
  queues: ['notifications', 'analytics'],
  data: { /* typed */ }
});
```

---

## Architecture Changes

### Before: One Worker Per Queue
```
Queue "crons" → Worker 1
Queue "notifications" → Worker 2
Queue "analytics" → Worker 3
= 3 processing servers ❌
```

### After: Unified Worker Pool
```
Unified Worker Pool (10 workers)
  ↓
All workers can process from:
  - Queue "crons"
  - Queue "notifications"  
  - Queue "analytics"
= 1 processing server ✅
```

---

## Key Features

### 1. Work Stealing
- Workers poll from all queues in round-robin
- If queue is empty, immediately try next queue
- Workers take more jobs when they have capacity

### 2. Dynamic Load Balancing
- Workers automatically balance load across queues
- No idle workers when other queues have jobs
- Better resource utilization

### 3. Type Safety
- Full TypeScript support
- Job data is typed
- Context is typed

### 4. Broadcast Support
- `publish()` sends job to multiple queues
- AMQP-like pattern
- Useful for event-driven architectures

---

## Migration Guide

### Step 1: Update Registration
```typescript
// Before
tempotask.registerJob({
  name: 'job',
  queue: 'queue',
  handler: async (job, ctx) => {
    ctx.addJob({ name: 'child', queue: 'queue', data: {} });
  }
});

// After
tempotask.registerJob<MyDataType>({
  name: 'job',
  queue: 'queue',
  handler: async (job, ctx) => {
    // job.data is typed as MyDataType
    ctx.enqueue({ name: 'child', queue: 'queue', data: {} });
  }
});
```

### Step 2: Update Job Addition
```typescript
// Before
tempotask.addJob({ name: 'job', queue: 'queue', data: {} });

// After
tempotask.enqueue({ name: 'job', queue: 'queue', data: {} });
```

### Step 3: Update Processing
```typescript
// Before
tempotask.processJobs(); // Synchronous

// After
await tempotask.start(); // Async
```

### Step 4: Use Broadcast (New!)
```typescript
// Broadcast to multiple queues
tempotask.publish({
  name: 'user.created',
  queues: ['notifications', 'analytics', 'logging'],
  data: { userId: 123 }
});
```

---

## Benefits

1. **Single Processing Server**: One unified pool instead of N workers
2. **Better Resource Usage**: Workers aren't idle when their queue is empty
3. **Work Stealing**: Workers automatically take jobs from busy queues
4. **Type Safety**: Full TypeScript support
5. **Broadcast Support**: Native event broadcasting
6. **Simpler Management**: One pool to manage, not N workers

---

## Testing

To test the new architecture:

```typescript
import { QueueManager } from '@core/mod.ts';
import { Redis } from 'ioredis';

const db = new Redis({ port: 6379, host: 'localhost', db: 1 });

const tempotask = QueueManager.init({
  db,
  ctx: {},
  concurrency: 5, // 5 workers total
  options: { maxJobsPerStatus: 10 }
});

// Register jobs
tempotask.registerJob({
  name: 'job1',
  queue: 'queue1',
  handler: async (job, ctx) => {
    console.log('Processing job1', job.data);
  }
});

tempotask.registerJob({
  name: 'job2',
  queue: 'queue2',
  handler: async (job, ctx) => {
    console.log('Processing job2', job.data);
  }
});

// Start unified worker pool
await tempotask.start();

// Enqueue jobs
tempotask.enqueue({ name: 'job1', queue: 'queue1', data: { test: 1 } });
tempotask.enqueue({ name: 'job2', queue: 'queue2', data: { test: 2 } });

// Broadcast
tempotask.publish({
  name: 'event',
  queues: ['queue1', 'queue2'],
  data: { broadcast: true }
});
```

---

## Next Steps

1. ✅ Unified worker pool implemented
2. ✅ Work stealing implemented
3. ✅ Type-safe registration
4. ✅ enqueue/publish API
5. ⏳ Update examples
6. ⏳ Update documentation
7. ⏳ Performance testing

---

## Notes

- Workers are queue-agnostic and can process from any queue
- Work stealing ensures no worker is idle when jobs are available
- Concurrency is now total across all queues, not per queue
- `publish()` enables AMQP-like event broadcasting patterns

