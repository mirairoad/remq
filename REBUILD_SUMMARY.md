# TempoTask v1.0 Rebuild Summary

## Executive Summary

This document summarizes the analysis and proposed rebuild of TempoTask from v0.78.0 to v1.0, focusing on transitioning from multiple processing servers to a single processing server with client-server architecture.

---

## Key Changes

### Architecture Shift

| Aspect | Current (v0.78.0) | Proposed (v1.0) |
|--------|-------------------|-----------------|
| **Processing** | Multiple workers (one per queue) | Single unified worker pool |
| **Architecture** | Monolithic (all in one process) | Client-Server separation |
| **Job Addition** | Direct Redis push | Client → Server → Redis |
| **Event Broadcasting** | Not supported | Native support (AMQP-like) |
| **Scalability** | Scale entire process | Scale client/server independently |

### What Stays the Same ✅

- **Queue & Worker Logic**: Core processing logic remains
- **Redis Streams**: Still using Redis streams for job storage
- **Job API**: `addJob()` API stays identical
- **Handler Signature**: Job handlers work the same way
- **Types & Interfaces**: Core types remain compatible

### What Changes 🔄

- **QueueManager → ProcessingServer**: New server class
- **Worker Creation**: Workers created in unified pool, not per queue
- **Client Layer**: New client for sending jobs
- **Event Broadcasting**: New capability for one-to-many job distribution

---

## Code Comparison

### Current Usage Pattern

```typescript
// Single process - everything together
const tempotask = QueueManager.init({
  db,
  ctx: contextApp,
  concurrency: 1,
  options: { maxJobsPerStatus: 10 }
});

tempotask.registerJob(job);
tempotask.processJobs(); // Starts workers
tempotask.addJob({ name: 'job', queue: 'queue', data: {} });
```

**Problem**: This creates one worker per queue, so you have multiple processing servers.

### Proposed Usage Pattern

#### Server Side
```typescript
// Processing server (single instance)
const server = ProcessingServer.create({
  redis: db,
  context: contextApp,
  concurrency: 10, // Total workers across all queues
  options: { maxJobsPerStatus: 10 },
  httpPort: 3000 // Optional HTTP API
});

server.registerJob(job);
await server.start(); // Starts unified worker pool
```

#### Client Side
```typescript
// Client (can be in separate process/API)
const client = new TempoTaskClient({
  serverUrl: 'http://localhost:3000'
  // or direct Redis: redis: db
});

// Same API as before
await client.addJob({
  name: 'job',
  queue: 'queue',
  data: {}
});

// New: Broadcast events
await client.broadcast({
  event: 'user.created',
  data: { userId: 123 },
  queues: ['notifications', 'analytics']
});
```

**Benefit**: Single processing server, clients can be anywhere (multiple APIs, services, etc.)

---

## Architecture Benefits

### 1. Single Processing Server
- **Before**: One worker per queue = multiple processing servers
- **After**: One unified worker pool = single processing server
- **Benefit**: Easier to manage, monitor, and scale

### 2. Client-Server Separation
- **Before**: Everything in one process
- **After**: Clients send jobs to server
- **Benefit**: Can have multiple APIs/services sending jobs to one server

### 3. Event Broadcasting
- **Before**: Not supported
- **After**: Native support for AMQP-like patterns
- **Benefit**: One event can trigger jobs in multiple queues

### 4. Scalability
- **Before**: Scale entire process (workers + queues + handlers)
- **After**: Scale client and server independently
- **Benefit**: Better resource utilization

---

## Implementation Phases

### Phase 1: Core Refactoring (Weeks 1-2)
- Extract worker pool logic
- Refactor QueueManager → JobDispatcher
- Separate worker creation from registration

### Phase 2: Server Implementation (Weeks 3-4)
- Create ProcessingServer class
- Implement unified worker pool
- Add HTTP API (optional)

### Phase 3: Client Implementation (Weeks 5-6)
- Create TempoTaskClient
- Support HTTP and direct Redis modes
- Maintain backward compatibility

### Phase 4: Event Broadcasting (Week 7)
- Implement broadcaster
- Add pub/sub support
- Test event distribution

### Phase 5: Testing & Release (Week 8)
- Comprehensive testing
- Documentation updates
- Migration guide
- v1.0.0 release

---

## Migration Path

### For Existing Users

**Option 1: Gradual Migration**
- Keep using current API
- Migrate to server mode when ready
- Both modes can coexist

**Option 2: Direct Migration**
- Replace `QueueManager` with `ProcessingServer`
- Move job addition to client
- Update to new API

### Backward Compatibility

- ✅ `addJob()` API stays the same
- ✅ `registerJob()` API stays the same
- ✅ Job handlers work the same
- ✅ Types remain compatible
- ⚠️ `processJobs()` → `start()` (now async)
- ⚠️ `QueueManager` → `ProcessingServer`

---

## File Structure Changes

### New Files
```
src/
├── client/              # NEW
│   ├── client.ts
│   ├── http-client.ts
│   └── redis-client.ts
├── server/              # NEW
│   ├── server.ts
│   ├── dispatcher.ts
│   ├── worker-pool.ts
│   └── http-api.ts
└── events/              # NEW
    ├── broadcaster.ts
    └── pubsub.ts
```

### Modified Files
```
src/libs/
├── queue-manager.ts → job-dispatcher.ts  # REFACTORED
├── queue.ts         # Minor changes
└── worker.ts        # Minor changes
```

---

## Key Design Decisions

### 1. Unified Worker Pool
**Decision**: Single pool of workers that process jobs from all queues
**Rationale**: Simpler management, better resource utilization, single processing server

### 2. Client-Server Architecture
**Decision**: Separate client and server layers
**Rationale**: Enables multiple APIs/services, better scalability, AMQP-like patterns

### 3. Keep Core Logic
**Decision**: Preserve Queue and Worker implementations
**Rationale**: Proven logic, minimal risk, easier migration

### 4. HTTP + Direct Redis
**Decision**: Support both HTTP and direct Redis client modes
**Rationale**: Flexibility - HTTP for remote, Redis for local/performance

### 5. Event Broadcasting
**Decision**: Native support for one-to-many job distribution
**Rationale**: Enables AMQP-like patterns, useful for microservices

---

## Success Criteria

### Functional Requirements
- ✅ Single processing server (unified worker pool)
- ✅ Client-server separation
- ✅ Event broadcasting support
- ✅ Backward compatible API
- ✅ HTTP API for remote clients

### Non-Functional Requirements
- ✅ Performance: Same or better than v0.78.0
- ✅ Simplicity: API remains simple
- ✅ Reliability: Same Redis stream reliability
- ✅ Scalability: Better than current architecture

---

## Next Steps

1. **Review Documents**:
   - `ARCHITECTURE_PROPOSAL.md` - Detailed architecture
   - `IMPLEMENTATION_PLAN.md` - Step-by-step plan
   - This summary

2. **Provide Feedback**:
   - Architecture decisions
   - API design
   - Implementation priorities
   - Migration concerns

3. **Start Implementation**:
   - Begin with Phase 1 (Core Refactoring)
   - Create feature branch
   - Iterate based on feedback

---

## Questions to Consider

1. **HTTP API**: Should HTTP API be required or optional?
2. **Worker Pool**: Should workers be queue-specific or truly unified?
3. **Event Broadcasting**: Priority for v1.0 or post-v1.0?
4. **Migration**: How much backward compatibility is needed?
5. **Performance**: Any specific performance requirements?

---

## Conclusion

The proposed rebuild maintains the simplicity and power of TempoTask while adding:
- Single processing server architecture
- Client-server separation
- Event broadcasting capabilities
- Better scalability

All while keeping the core logic and API that users love.

