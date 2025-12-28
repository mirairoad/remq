# Complete Rebuild Approach - Unified Worker Pool

## The Problem

**Current Architecture:**
```typescript
// Each registerJob() creates a worker for that queue
registerJob({ queue: 'crons', ... })     → Worker for 'crons'
registerJob({ queue: 'notifications', ... }) → Worker for 'notifications'
registerJob({ queue: 'analytics', ... })  → Worker for 'analytics'

// Result: 3 workers = 3 processing servers ❌
```

**What You Want:**
```typescript
// Single unified worker pool processes ALL queues
// Workers are queue-agnostic and can handle any queue
// Result: 1 processing server ✅
```

---

## The Solution: Unified Worker Pool

### Key Changes

1. **Workers are Queue-Agnostic**: Workers don't belong to a specific queue
2. **Multi-Queue Polling**: Workers poll from ALL registered queues
3. **Handler Routing**: Route jobs to correct handler based on queue+name
4. **Single Processing Server**: One pool of workers handles everything

---

## New Architecture

```
┌─────────────────────────────────────────┐
│      Processing Server (Single)         │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │    Unified Worker Pool            │ │
│  │                                    │ │
│  │  Worker 1  Worker 2  Worker 3     │ │
│  │     │         │         │          │ │
│  │     └─────────┼─────────┘          │ │
│  │              │                     │ │
│  │     ┌────────▼────────┐           │ │
│  │     │  Queue Poller   │           │ │
│  │     │  (All Queues)   │           │ │
│  │     └────────┬────────┘           │ │
│  │              │                     │ │
│  │     ┌────────▼────────┐           │ │
│  │     │  Job Router     │           │ │
│  │     │  (queue:name)   │           │ │
│  │     └────────┬────────┘           │ │
│  │              │                     │ │
│  │     ┌────────▼────────┐           │ │
│  │     │  Handler Map    │           │ │
│  │     │  crons:hello    │           │ │
│  │     │  crons:multi    │           │ │
│  │     │  notifications:email        │ │
│  │     └─────────────────┘           │ │
│  └───────────────────────────────────┘ │
│                                         │
│  ┌───────────────────────────────────┐ │
│  │      Queue Manager                │ │
│  │  (Manages queues, no workers)     │ │
│  └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## Implementation Plan

### Step 1: Make Worker Queue-Agnostic

**Current Worker Problem:**
- Worker is tied to `this.key` (specific queue)
- `readQueueStream(this.key)` only reads from one queue

**Solution:**
- Remove queue-specific logic from Worker
- Create `UnifiedWorker` that polls multiple queues
- Route jobs to handlers based on queue+name

### Step 2: Create Unified Worker Pool

**New Class: `UnifiedWorkerPool`**
- Manages pool of queue-agnostic workers
- Workers poll from ALL registered queues
- Routes jobs to correct handlers

### Step 3: Refactor QueueManager

**Changes:**
- Remove worker creation from `registerJob()`
- Only register handlers (queue+name → handler)
- Let UnifiedWorkerPool handle processing

### Step 4: Multi-Queue Polling

**New Logic:**
- Workers poll from multiple queues in round-robin or priority
- Get jobs from any queue
- Route to handler based on queue+name

---

## Code Structure

### New: `src/libs/unified-worker-pool.ts`

```typescript
export class UnifiedWorkerPool {
  private workers: UnifiedWorker[] = [];
  private handlers: Map<string, JobHandler> = new Map();
  private queues: Set<string> = new Set();
  
  constructor(
    private db: RedisConnection,
    private streamdb: RedisConnection,
    private concurrency: number,
    private ctx: unknown
  ) {}
  
  // Register handler (no worker creation)
  registerHandler(queue: string, name: string, handler: JobHandler): void {
    const key = `${queue}:${name}`;
    this.handlers.set(key, handler);
    this.queues.add(queue);
  }
  
  // Start unified worker pool
  async start(): Promise<void> {
    // Create workers that can process ANY queue
    for (let i = 0; i < this.concurrency; i++) {
      const worker = new UnifiedWorker(
        this.db,
        this.streamdb,
        this.routeJob.bind(this),
        { concurrency: 1 }
      );
      this.workers.push(worker);
      worker.start();
    }
  }
  
  // Route job to correct handler
  private async routeJob(jobData: JobData): Promise<void> {
    const key = `${jobData.state.queue}:${jobData.state.name}`;
    const handler = this.handlers.get(key);
    
    if (!handler) {
      throw new Error(`No handler found for ${key}`);
    }
    
    // Create logger
    const logger = await this.createLogger(jobData);
    
    // Call handler with logger
    return handler({
      ...jobData.state,
      logger,
    }, this.ctx);
  }
  
  // Get all registered queues
  getQueues(): string[] {
    return Array.from(this.queues);
  }
}
```

### New: `src/libs/unified-worker.ts`

```typescript
export class UnifiedWorker extends EventTarget {
  private queues: string[] = [];
  private isProcessing = false;
  private processingController = new AbortController();
  
  constructor(
    private db: RedisConnection,
    private streamdb: RedisConnection,
    private handler: (job: JobData) => Promise<void>,
    private options: WorkerOptions
  ) {
    super();
  }
  
  // Update queues to poll from
  updateQueues(queues: string[]): void {
    this.queues = queues;
  }
  
  // Start processing from all queues
  async start(): Promise<void> {
    this.isProcessing = true;
    
    while (!this.processingController.signal.aborted) {
      try {
        // Poll from all queues (round-robin or priority)
        const job = await this.pollFromQueues();
        
        if (job) {
          await this.handler(job);
        } else {
          await delay(this.options.pollIntervalMs || 3000);
        }
      } catch (error) {
        console.error('Error in unified worker:', error);
        await delay(this.options.pollIntervalMs || 3000);
      }
    }
    
    this.isProcessing = false;
  }
  
  // Poll from all registered queues
  private async pollFromQueues(): Promise<JobData | null> {
    // Strategy 1: Round-robin through queues
    for (const queueName of this.queues) {
      const jobs = await this.readQueueStream(queueName, 1, 1000);
      if (jobs.length > 0) {
        return jobs[0];
      }
    }
    
    // Strategy 2: Priority-based (if needed)
    // Could prioritize certain queues
    
    return null;
  }
  
  // Read from a specific queue stream
  private async readQueueStream(
    queueName: string,
    count: number = 1,
    block: number = 1000
  ): Promise<JobData[]> {
    // Similar to current Worker.readQueueStream but queue-agnostic
    // Implementation here
  }
  
  stop(): void {
    this.processingController.abort();
  }
}
```

### Refactored: `src/libs/queue-manager.ts`

```typescript
export class QueueManager<T = unknown> {
  private queues: Map<string, Queue> = new Map();
  private workerPool: UnifiedWorkerPool;
  private handlers: Map<string, JobHandler> = new Map();
  
  static init<T>(config: InitConfig<T>): QueueManager<T> {
    return new QueueManager(config);
  }
  
  private constructor(config: InitConfig<T>) {
    // Create unified worker pool (no workers yet)
    this.workerPool = new UnifiedWorkerPool(
      config.db,
      config.streamdb || config.db,
      config.concurrency,
      config.ctx
    );
  }
  
  // Register job - NO worker creation
  registerJob<D = unknown>(job: Task<D, T>): void {
    const queueName = job.queue;
    
    // Create queue if doesn't exist
    if (!this.queues.has(queueName)) {
      const queue = new Queue(this.db, queueName, this.streamdb);
      this.queues.set(queueName, queue);
      this.createConsumerGroup(queueName);
    }
    
    // Register handler in worker pool
    this.workerPool.registerHandler(
      queueName,
      job.name,
      job.handler
    );
    
    // Update worker pool with all queues
    this.workerPool.updateQueues(Array.from(this.queues.keys()));
  }
  
  // Add job (same as before)
  addJob(args: AddJobArgs): void {
    const queue = this.queues.get(args.queue);
    if (!queue) {
      throw new Error(`Queue ${args.queue} not found`);
    }
    queue.pushJob(args, {});
  }
  
  // Start processing - starts unified worker pool
  async start(): Promise<void> {
    await this.workerPool.start();
  }
  
  // Shutdown
  shutdown(): void {
    this.workerPool.stop();
  }
}
```

---

## Benefits

1. **Single Processing Server**: One worker pool handles all queues
2. **Better Resource Usage**: Workers aren't idle when their queue is empty
3. **Simpler Management**: One pool to manage, not N workers
4. **Flexible**: Can prioritize queues or balance load
5. **Scalable**: Easy to adjust worker count

---

## Migration Path

### Phase 1: Create UnifiedWorkerPool
- Extract worker pool logic
- Make workers queue-agnostic
- Test with single queue

### Phase 2: Refactor QueueManager
- Remove worker creation from registerJob
- Use UnifiedWorkerPool
- Test with multiple queues

### Phase 3: Multi-Queue Polling
- Implement round-robin or priority polling
- Test performance
- Optimize

### Phase 4: Client-Server (Optional)
- Add client layer
- Add HTTP API
- Test end-to-end

---

## Key Design Decisions

1. **Queue-Agnostic Workers**: Workers don't know about specific queues
2. **Handler Routing**: Route based on queue+name key
3. **Multi-Queue Polling**: Poll from all queues, not just one
4. **Unified Pool**: Single pool manages all workers

---

## Questions

1. **Polling Strategy**: Round-robin or priority-based?
2. **Concurrency**: Per-worker or per-queue?
3. **Queue Priority**: Should some queues be prioritized?
4. **Backward Compatibility**: Keep old API or break it?

