# TaskManager

High-level API for task/job management. Simple, developer-friendly interface built on top of Consumer + Processor.

## Features

- **Simple API** - Easy to use, similar to the original ProcessingManager
- **registerHandler()** - Register handlers for events/jobs
- **emit()** - Trigger jobs/events
- **Built on Consumer + Processor** - Gets all the benefits (retries, DLQ, debouncing)
- **Automatic queue management** - Queues are created automatically
- **Context support** - Pass context to handlers with emit function

## Usage

### Basic Setup

```typescript
import { TaskManager } from './mod.ts';
import { Redis } from 'ioredis';

const db = new Redis({
  port: 6379,
  host: 'localhost',
  db: 1,
});

// Initialize TaskManager
const taskManager = TaskManager.init({
  db,
  ctx: {}, // Your app context
  concurrency: 4,
  processor: {
    retry: {
      maxRetries: 3,
      retryDelayMs: 1000,
    },
    debounce: 300, // Optional: 5 minutes debounce
  },
});

// Register handlers
taskManager.registerHandler({
  handler: async (job, ctx) => {
    console.log('Processing:', job.name, job.data);
    await job.logger?.('Job started');
    
    // Do work...
    
    // Emit child jobs if needed
    ctx.emit({
      event: 'child-job',
      data: { parentId: job.data.id },
    });
    
    await job.logger?.('Job completed');
  },
  event: 'my-event',
  queue: 'default',
});

// Start processing
await taskManager.start();
```

### With Cron/Repeatable Jobs

```typescript
taskManager.registerHandler({
  handler: async (job, ctx) => {
    console.log('Cron job running:', new Date());
  },
  event: 'daily-report',
  queue: 'scheduler',
  options: {
    repeat: {
      pattern: '0 0 * * *', // Every day at midnight
    },
  },
});
```

### Emit Jobs

```typescript
// Emit a simple job
taskManager.emit({
  event: 'process-user',
  data: { userId: '123' },
});

// Emit with options
taskManager.emit({
  event: 'send-email',
  queue: 'emails',
  data: { to: 'user@example.com' },
  options: {
    retryCount: 3,
    delayUntil: new Date(Date.now() + 60000), // Delay 1 minute
  },
});
```

### Using Context

```typescript
interface AppContext {
  db: Database;
  cache: Cache;
  config: Config;
}

const taskManager = TaskManager.init({
  db: redisClient,
  ctx: {
    db: myDatabase,
    cache: myCache,
    config: myConfig,
  },
  concurrency: 4,
});

taskManager.registerHandler(
  async (job, ctx) => {
    // Access your context
    const user = await ctx.db.getUser(job.data.userId);
    await ctx.cache.set(`user:${user.id}`, user);
    
    // Emit new jobs
    ctx.emit({
      event: 'notify-user',
      data: { userId: user.id },
    });
  },
  {
    event: 'process-user',
  },
);
```

## API

### `TaskManager.init(options)`

Initialize TaskManager (singleton pattern).

**Options:**
- `db: RedisConnection` - Redis connection for job storage
- `ctx?: T` - Context object passed to handlers
- `concurrency?: number` - Number of concurrent jobs (default: 1)
- `streamdb?: RedisConnection` - Optional separate Redis connection for streams
- `processor?: { retry?, dlq?, debounce?, ignoreConfigErrors? }` - Processor options

### `registerHandler(options)`

Register a handler for an event/job.

**Options:**
- `handler: TaskHandler<T, D>` - Handler function
- `event: string` - Event/Job name
- `queue?: string` - Queue name (defaults to 'default')
- `options?: { repeat?, attempts? }` - Job options (for cron)

**Handler signature:**
```typescript
(job: {
  name: string;
  queue: string;
  data?: D;
  logger?: (message: string | object) => Promise<void>;
}, ctx: T & { emit: EmitFunction }) => Promise<void> | void
```

### `emit(args)`

Emit/trigger a job/event.

**Args:**
- `event: string` - Event name
- `queue?: string` - Queue name (defaults to 'default')
- `data?: unknown` - Job data
- `options?: { id?, priority?, delayUntil?, retryCount?, repeat?, attempts? }` - Job options

### `start()`

Start processing jobs. Creates consumer groups and starts processors.

### `stop()`

Stop processing jobs. Waits for active tasks to complete.

### `getContext()`

Get the context object (useful for accessing emit function outside handlers).

## Integration with Consumer + Processor

TaskManager uses Consumer + Processor internally, so you get all their features:

- ✅ Stable consumer IDs
- ✅ Correct ACK timing
- ✅ Retries with exponential backoff
- ✅ DLQ routing
- ✅ Debouncing
- ✅ Delay handling
- ✅ Multi-queue support

## Architecture

```
TaskManager (High-level API)
  ↓
Processor (Policy layer: retries, delays, DLQ, debounce)
  ↓
Consumer (Runtime engine: fetch, process, ack, events)
  ↓
Redis Streams
```

