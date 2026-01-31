# Admin Store - Management API

Simple management API for jobs, designed for admin interfaces.

## Features

- **Get Job by ID** - Retrieve a specific job
- **List Jobs** - List jobs with filtering (queue, status, pagination)
- **Delete Job** - Remove a job from the system
- **Get Queue Stats** - Get statistics for a queue (counts by status)
- **Get Queues** - List all queues
- **Retry Job** - Retry a failed job
- **Cancel Job** - Cancel a waiting/delayed job

## Usage

### Basic Setup

```typescript
import { AdminStore } from '@core/mod.ts';
import { Redis } from 'ioredis';

const db = new Redis({
  port: 6379,
  host: 'localhost',
  db: 1,
});

// Create admin store
const adminStore = new AdminStore(db);
```

### Get Job by ID

```typescript
const job = await adminStore.getJob('job-id-123', 'default');

if (job) {
  console.log('Job status:', job.status);
  console.log('Job data:', job.state.data);
  console.log('Job logs:', job.logs);
}
```

### List Jobs

```typescript
// List all jobs in a queue
const jobs = await adminStore.listJobs({
  queue: 'default',
  limit: 50,
  offset: 0,
});

// List only failed jobs
const failedJobs = await adminStore.listJobs({
  queue: 'default',
  status: 'failed',
  limit: 20,
});

// List processing jobs
const processingJobs = await adminStore.listJobs({
  queue: 'default',
  status: 'processing',
});
```

### Delete Job

```typescript
await adminStore.deleteJob('job-id-123', 'default');
```

### Get Queue Statistics

```typescript
const stats = await adminStore.getQueueStats('default');

console.log('Total jobs:', stats.total);
console.log('Waiting:', stats.waiting);
console.log('Processing:', stats.processing);
console.log('Completed:', stats.completed);
console.log('Failed:', stats.failed);
console.log('Delayed:', stats.delayed);
```

### Get All Queues

```typescript
const queues = await adminStore.getQueues();
console.log('Available queues:', queues);
// ['default', 'scheduler', 'emails', ...]
```

### Get Queues with Statistics

```typescript
const queuesInfo = await adminStore.getQueuesInfo();

for (const queueInfo of queuesInfo) {
  console.log(`Queue: ${queueInfo.name}`);
  console.log(`  Total: ${queueInfo.stats.total}`);
  console.log(`  Waiting: ${queueInfo.stats.waiting}`);
  console.log(`  Processing: ${queueInfo.stats.processing}`);
  console.log(`  Failed: ${queueInfo.stats.failed}`);
}
```

### Retry Failed Job

```typescript
// Retry a failed job
const retriedJob = await adminStore.retryJob('job-id-123', 'default');

if (retriedJob) {
  console.log('Job retried, new status:', retriedJob.status);
  console.log('Retry attempt:', retriedJob.retriedAttempts);
}
```

### Cancel Job

```typescript
// Cancel a waiting or delayed job
try {
  const cancelled = await adminStore.cancelJob('job-id-123', 'default');
  if (cancelled) {
    console.log('Job cancelled successfully');
  }
} catch (error) {
  console.error('Cannot cancel job:', error.message);
}
```

## Types

| Type | Purpose | Main fields |
| --- | --- | --- |
| `AdminJobData` | Stored job record | `id`, `state`, `status`, timestamps (`timestamp`, `lastRun`, `delayUntil`, `lockUntil`), `logs`, `errors`, `paused` |
| `ListJobsOptions` | List/filter options for `listJobs` | `queue`, `status`, `limit`, `offset` |
| `JobStats` | Per-queue status counts | `queue`, `waiting`, `processing`, `completed`, `failed`, `delayed`, `total` |
| `QueueInfo` | Queue name + stats bundle | `name`, `stats` |

## API Reference

### `getJob(jobId: string, queue: string): Promise<AdminJobData | null>`

Retrieves a job by ID and queue name. Returns `null` if not found.

### `listJobs(options?: ListJobsOptions): Promise<AdminJobData[]>`

Lists jobs with optional filtering:

- `queue` (required) - Queue name to search
- `status` (optional) - Filter by status (waiting, processing, completed, failed, delayed)
- `limit` (optional, default: 100) - Maximum number of jobs to return
- `offset` (optional, default: 0) - Offset for pagination

Jobs are sorted by timestamp (newest first).

### `deleteJob(jobId: string, queue: string): Promise<void>`

Deletes a job and all its associated data (status keys, logs).

### `getQueueStats(queue: string): Promise<JobStats>`

Returns statistics for a queue:

```typescript
interface JobStats {
  queue: string;
  waiting: number;
  processing: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}
```

### `getQueues(): Promise<string[]>`

Returns a list of all queue names discovered by scanning Redis keys.

### `getQueuesInfo(): Promise<QueueInfo[]>`

Returns all queues with their statistics:

```typescript
interface QueueInfo {
  name: string;
  stats: JobStats;
}
```

### `retryJob(jobId: string, queue: string): Promise<AdminJobData | null>`

Retries a job by recreating it as `waiting`, incrementing `retriedAttempts`, and
adding a retry log entry. Returns the updated job data, or `null` if not found.

Throws an error if the job status is not `failed` (only failed jobs can be retried).

**Note:** The job will need to be re-emitted to the stream to be processed. This method only updates the Redis state.

### `cancelJob(jobId: string, queue: string): Promise<boolean>`

Cancels a waiting or delayed job. Returns `true` if successful, `false` if job not found.

Throws an error if trying to cancel a job that's not in waiting/delayed status.

## Control Methods

### `pauseQueue(queue: string): Promise<void>` / `resumeQueue(queue: string): Promise<void>` / `isQueuePaused(queue: string): Promise<boolean>`

Pauses or resumes a queue by toggling a pause key in Redis. `isQueuePaused`
returns `true` when the pause key exists.

These methods do not throw if the queue is unknown.

### `pauseJob(jobId: string, queue: string): Promise<AdminJobData | null>` / `resumeJob(jobId: string, queue: string): Promise<AdminJobData | null>`

Pauses or resumes an individual job by toggling its `paused` flag. Returns the
updated job or `null` if not found.

`pauseJob` throws an error if the job status is not `waiting` or `delayed`.

## Integration with TaskManager

You can use `AdminStore` alongside `TaskManager`:

```typescript
import { TaskManager, AdminStore } from '@core/mod.ts';
import { Redis } from 'ioredis';

const db = new Redis({ port: 6379, host: 'localhost', db: 1 });
const streamdb = new Redis({ port: 6379, host: 'localhost', db: 2 });

// Create TaskManager
const taskManager = TaskManager.init({
  db,
  streamdb,
  ctx: {},
  concurrency: 4,
});

// Create AdminStore (uses same db connection)
const adminStore = new AdminStore(db);

// Use in your admin API/interface
app.get('/api/jobs', async (req, res) => {
  const jobs = await adminStore.listJobs({
    queue: req.query.queue || 'default',
    status: req.query.status,
    limit: parseInt(req.query.limit) || 50,
  });
  res.json(jobs);
});

app.get('/api/jobs/:id', async (req, res) => {
  const job = await adminStore.getJob(req.params.id, req.query.queue);
  if (job) {
    res.json(job);
  } else {
    res.status(404).json({ error: 'Job not found' });
  }
});

app.delete('/api/jobs/:id', async (req, res) => {
  await adminStore.deleteJob(req.params.id, req.query.queue);
  res.json({ success: true });
});
```

## Performance Considerations

- **SCAN vs KEYS**: Uses `SCAN` instead of `KEYS` for better performance in production
- **Pagination**: List operations support pagination to handle large datasets
- **Caching**: Consider caching queue statistics if frequently accessed
- **Stream Operations**: Note that `retryJob` only updates Redis state - you may need to re-emit via `TaskManager.emit()` to actually process the job

## Future Enhancements

Potential additions:
- Bulk operations (delete multiple jobs)
- Job search by data/name
- Job history/timeline
- Real-time updates (via pub/sub)
- Export jobs to JSON/CSV
