# TaskManager Example Usage

## Simple Setup (similar to original plugin.ts)

```typescript
import { TaskManager } from './mod.ts';
import { Redis } from 'ioredis';

// Create Redis connection
const db = new Redis({
  port: 6379,
  host: 'localhost',
  db: 1,
});

// Define context for your app
const contextApp = {};

// Initialize TaskManager (simple API)
const taskManager = TaskManager.init({
  db,
  ctx: contextApp,
  concurrency: 4,
  processor: {
    retry: {
      maxRetries: 3,
      retryDelayMs: 1000,
    },
    debounce: 300, // Optional: 5 minutes debounce
  },
});

// Register handler (delegates code)
taskManager.registerHandler({
  handler: async (job, ctx) => {
    console.log('Processing:', job.name, job.data);
    await job.logger?.('Job started');
    
    // Your business logic here
    // ...
    
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

export { taskManager };
```

## With Cron Jobs

```typescript
// Register a cron job (runs every 5 minutes)
taskManager.registerHandler({
  handler: async (job, ctx) => {
    console.log('Cron job running:', new Date());
  },
  event: 'periodic-task',
  queue: 'scheduler',
  options: {
    repeat: {
      pattern: '*/5 * * * *', // Every 5 minutes
    },
  },
});
```

## Emit Jobs (Execution)

```typescript
// Emit a simple job
taskManager.emit({
  event: 'process-user',
  data: { userId: '123' },
});

// Emit with retry options
taskManager.emit({
  event: 'send-email',
  queue: 'emails',
  data: { to: 'user@example.com', subject: 'Hello' },
  options: {
    retryCount: 3,
    delayUntil: new Date(Date.now() + 60000), // Delay 1 minute
  },
});
```

## Complete Example

```typescript
import { TaskManager } from '@core_v2/libs/task-manager/mod.ts';
import { Redis } from 'ioredis';

const db = new Redis({ port: 6379, host: 'localhost', db: 1 });

const taskManager = TaskManager.init({
  db,
  ctx: {},
  concurrency: 4,
});

// Register handler
taskManager.registerHandler({
  handler: async (job, ctx) => {
    console.log(`Processing ${job.name} with data:`, job.data);
    await job.logger?.('Started processing');
    
    // Do work
    // ...
    
    // Emit follow-up job
    ctx.emit({
      event: 'follow-up',
      data: { originalJob: job.name },
    });
  },
  event: 'main-job',
  queue: 'default',
});

// Start
await taskManager.start();

// Emit jobs
taskManager.emit({
  event: 'main-job',
  data: { taskId: '123' },
});
```

