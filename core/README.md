# Core API

Main modules for task/job processing with Redis Streams.

## API list

### TaskManager (`libs/task-manager/task-manager.ts`)

| Method | Signature |
|--------|-----------|
| `init` | `static init<T>(options): TaskManager<T>` |
| `registerHandler` | `registerHandler(options): Promise<void>` |
| `emit` | `emit(args: { event, queue?, data?, options? }): void` |
| `start` | `start(): Promise<void>` |
| `stop` | `stop(): Promise<void>` |
| `pauseQueue` | `pauseQueue(queue: string): Promise<void>` |
| `resumeQueue` | `resumeQueue(queue: string): Promise<void>` |
| `isQueuePaused` | `isQueuePaused(queue: string): Promise<boolean>` |

### Consumer (`libs/consumer/`)

| Class / Method | Description |
|----------------|-------------|
| `Consumer` | Main consumer class |
| `Consumer.constructor` | `(options: ConsumerOptions)` |
| `Consumer.start` | `start(options?): Promise<void>` |
| `Consumer.stop` | `stop(): void` |
| `Consumer.waitForActiveTasks` | `waitForActiveTasks(): Promise<void>` |
| `StreamReader` | Redis Stream reading with consumer groups |
| `ConcurrencyPool` | Manages concurrent message processing |

### Processor (`libs/processor/`)

| Class / Method | Description |
|----------------|-------------|
| `Processor` | Policy layer wrapping Consumer |
| `Processor.constructor` | `(options: ProcessorOptions)` |
| `Processor.start` | `start(options?): Promise<void>` |
| `Processor.stop` | `stop(): void` |
| `Processor.waitForActiveTasks` | `waitForActiveTasks(): Promise<void>` |
| `Processor.cleanup` | `cleanup(): void` |
| `DebounceManager` | Per-handler debouncing |

### AdminStore (`libs/admin/`)

| Method | Description |
|--------|-------------|
| `getJob` | `getJob(jobId, queue): Promise<AdminJobData \| null>` |
| `listJobs` | `listJobs(options?): Promise<AdminJobData[]>` |
| `deleteJob` | `deleteJob(jobId, queue): Promise<void>` |
| `retryJob` | `retryJob(jobId, queue): Promise<AdminJobData \| null>` |
| `cancelJob` | `cancelJob(jobId, queue): Promise<boolean>` |
| `getQueueStats` | `getQueueStats(queue): Promise<JobStats>` |
| `getQueues` | `getQueues(): Promise<string[]>` |
| `getQueuesInfo` | `getQueuesInfo(): Promise<QueueInfo[]>` |
| `pauseQueue` | `pauseQueue(queue): Promise<void>` |
| `resumeQueue` | `resumeQueue(queue): Promise<void>` |
| `isQueuePaused` | `isQueuePaused(queue): Promise<boolean>` |
| `pauseJob` | `pauseJob(jobId, queue): Promise<AdminJobData \| null>` |
| `resumeJob` | `resumeJob(jobId, queue): Promise<AdminJobData \| null>` |

### Types

| Type | Module |
|------|--------|
| `TaskManagerOptions`, `TaskHandler`, `EmitFunction`, `RegisterHandlerOptions` | `types/task-manager.ts` |
| `ConsumerOptions`, `Message`, `MessageHandler`, `MessageContext`, `ConsumerEvents` | `types/` |
| `ProcessorOptions`, `ProcessableMessage`, `RetryConfig`, `DLQConfig`, `DebounceConfig` | `types/processor.ts` |
| `AdminJobData`, `ListJobsOptions`, `JobStats`, `QueueInfo` | `types/admin.ts` |

---

## Quick init example

```ts
import { TaskManager } from './libs/task-manager/mod.ts';
import Redis from 'ioredis';

const redisOption = {
  port: 6379,
  host: 'localhost',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  db: 1,
};

const db = new Redis(redisOption);
const streamdb = new Redis({ ...redisOption, db: 2 }); // optional: separate stream connection

const tm = TaskManager.init({
  db,
  streamdb,
  ctx: {},
  concurrency: 2,
  processor: {
    retry: { maxRetries: 3, retryDelayMs: 1000 },
    dlq: {
      streamKey: 'remq-dlq',
      shouldSendToDLQ: (_, __, attempts) => attempts >= 3,
    },
  },
});

// Register handler
await tm.registerHandler({
  handler: async (job, ctx) => {
    console.log('Processing:', job.data);
    ctx.emit({ event: 'follow-up', data: { from: job.name } });
  },
  event: 'my-event',
  queue: 'default',
  options: {
    repeat: { pattern: '*/30 * * * * *' }, // every 30s
    attempts: 3,
  },
});

// Emit job
tm.emit({ event: 'my-event', data: { id: 1 } });

// Start
await tm.start();
```
