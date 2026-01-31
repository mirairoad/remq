---
title: AdminStore
description: AdminStore helper APIs for queue administration.
---

# AdminStore

The `AdminStore` class is a management API for admin interfaces. It provides
CRUD and control for admin UIs over jobs stored in Redis.

## Minimal example

```typescript
const adminStore = new AdminStore(db);

const queues = await adminStore.getQueuesInfo();
const failedJobs = await adminStore.listJobs({
  queue: 'default',
  status: 'failed',
  limit: 10,
});
if (failedJobs[0]) {
  await adminStore.retryJob(failedJobs[0].id, 'default');
}
```

## Constructor

```typescript
new AdminStore(db: RedisConnection)
```

`db` is the Redis connection used for CRUD and control operations. It should be
the same connection used by `TaskManager` so queue state is consistent.

## Types

| Type | Purpose | Main fields |
| --- | --- | --- |
| `AdminJobData` | Stored job record | `id`, `state`, `status`, timestamps (`timestamp`, `lastRun`, `delayUntil`, `lockUntil`), `logs`, `errors`, `paused` |
| `ListJobsOptions` | List/filter options for `listJobs` | `queue`, `status`, `limit`, `offset` |
| `JobStats` | Per-queue status counts | `queue`, `waiting`, `processing`, `completed`, `failed`, `delayed`, `total` |
| `QueueInfo` | Queue name + stats bundle | `name`, `stats` |

## AdminJobData

`AdminJobData` represents a stored job record.

```typescript
interface AdminJobData {
  id: string;
  state: {
    name: string;
    queue: string;
    data?: unknown;
    options?: {
      repeat?: { pattern: string };
      [key: string]: unknown;
    };
  };
  status: 'waiting' | 'processing' | 'completed' | 'failed' | 'delayed';
  delayUntil: number;
  lockUntil: number;
  priority: number;
  retryCount: number;
  retryDelayMs: number;
  retriedAttempts: number;
  repeatCount: number;
  repeatDelayMs: number;
  logs: Array<{ message: string; timestamp: number }>;
  errors: string[];
  timestamp: number;
  lastRun?: number;
  paused?: boolean;
}
```

## ListJobsOptions

```typescript
interface ListJobsOptions {
  queue?: string;
  status?: 'waiting' | 'processing' | 'completed' | 'failed' | 'delayed';
  limit?: number;
  offset?: number;
}
```

queue is required by `listJobs` and is validated at runtime.

## JobStats and QueueInfo

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

interface QueueInfo {
  name: string;
  stats: JobStats;
}
```

## Methods

### `getJob(jobId: string, queue: string): Promise<AdminJobData | null>`

Params:

- `jobId` (string) - Job id to look up.
- `queue` (string) - Queue name to search.

Returns the job data or `null` if not found. The lookup checks all
known statuses (`waiting`, `processing`, `completed`, `failed`, `delayed`).

### `listJobs(options?: ListJobsOptions): Promise<AdminJobData[]>`

Lists jobs for a queue with optional status filtering and pagination.

`ListJobsOptions`:

- `queue` (required) - Queue name to list.
- `status` (optional) - Status filter (`waiting`, `processing`, `completed`, `failed`, `delayed`).
- `limit` (optional) - Max number of jobs to return.
- `offset` (optional) - Pagination offset.

```typescript
const jobs = await adminStore.listJobs({
  queue: 'default',
  status: 'failed',
  limit: 50,
  offset: 0,
});
```

Notes:

- `queue` is required and missing it throws.
- Jobs are sorted by `timestamp` (newest first).

### `deleteJob(jobId: string, queue: string): Promise<void>`

Params:

- `jobId` (string) - Job id to delete.
- `queue` (string) - Queue name to delete from.

Deletes a job and its logs from Redis.

### `getQueueStats(queue: string): Promise<JobStats>`

Params:

- `queue` (string) - Queue name to inspect.

Returns a `JobStats` object with counts by status plus a `total` for a single queue.

### `getQueues(): Promise<string[]>`

Scans Redis keys and returns discovered queue names.

### `getQueuesInfo(): Promise<QueueInfo[]>`

Returns all queues with their statistics as `QueueInfo` objects (`name` + `stats`).

### `retryJob(jobId, queue)`

Params:

- `jobId` (string) - Job id to retry.
- `queue` (string) - Queue name to retry within.

Retries a job by recreating it as `waiting`, incrementing `retriedAttempts`,
and appending a retry log entry. Returns the updated job or `null` if the job
is missing.

Errors:

- Throws if the job status is not `failed` (only failed jobs can be retried).

Note: this method only updates Redis state. Re-emit the job via
`TaskManager.emit()` to actually process it.

### `cancelJob(jobId, queue)`

Params:

- `jobId` (string) - Job id to cancel.
- `queue` (string) - Queue name to cancel within.

Cancels a job by deleting it. Returns `true` when cancelled and `false` when
the job is not found.

Errors:

- Throws if the job status is not `waiting` or `delayed` (only those can be
  cancelled).

## Queue controls

### `pauseQueue(queue)` / `resumeQueue(queue)` / `isQueuePaused(queue)`

Pauses and resumes a queue by toggling a Redis pause key. `TaskManager` checks
this key before processing new jobs, so pausing a queue prevents work from
starting.

Behavior:

- `pauseQueue` sets the pause key for the queue.
- `resumeQueue` deletes the pause key for the queue.
- `isQueuePaused` returns `true` when the pause key exists, otherwise `false`.

Errors:

- These methods do not throw if the queue has no jobs or is unknown.

### `pauseJob(jobId, queue)` / `resumeJob(jobId, queue)`

Pauses or resumes an individual job by toggling its `paused` flag. Returns the
updated job or `null` if the job is missing.

Behavior:

- `pauseJob` sets `paused: true` on the job.
- `resumeJob` sets `paused: false` on the job.

Errors:

- `pauseJob` throws if the job status is not `waiting` or `delayed` (only those
  can be paused).

## Next Steps

- [TaskManager API](/reference/task-manager)
- [Consumer API](/reference/consumer)
- [Processor API](/reference/processor)
