---
title: Admin Dashboard
description: Build admin dashboards with AdminStore queue visibility and controls.
---

# Admin Dashboard

REMQ ships with the `AdminStore` API for building admin consoles and
operational dashboards. Use it to inspect queues, browse jobs, and perform
control actions like pause, retry, or cancel.

## When to add a dashboard

Add an admin dashboard when you need visibility into queue health, need to
inspect failed jobs, or want safe operational controls for on-call workflows.

## Connect AdminStore

`AdminStore` should use the same Redis connection as your `TaskManager` so it
sees consistent queue state.

```typescript
import Redis from 'npm:ioredis';
import { AdminStore, TaskManager } from 'npm:@leotermine/tasker';

const db = new Redis({ host: '127.0.0.1', port: 6379 });
const taskManager = TaskManager.init({ db });
const adminStore = new AdminStore(db);
```

## Queue overview cards

Use `getQueuesInfo()` or `getQueueStats()` to populate queue summary tiles.
Each `JobStats` entry includes per-status counts.

```typescript
const queues = await adminStore.getQueuesInfo();
const stats = await adminStore.getQueueStats('default');
```

## Job browser and detail views

List jobs with filters and display details with a job lookup.

```typescript
const failedJobs = await adminStore.listJobs({
  queue: 'default',
  status: 'failed',
  limit: 25,
  offset: 0,
});

const job = await adminStore.getJob(failedJobs[0]?.id ?? '', 'default');
```

## Control actions

Expose simple actions with guardrails. `retryJob()` and `deleteJob()` are the
most common controls when you need to re-run or cancel a job.

```typescript
if (failedJobs[0]) {
  await adminStore.retryJob(failedJobs[0].id, 'default');
  await taskManager.emit({
    event: failedJobs[0].state.name,
    queue: failedJobs[0].state.queue,
    data: failedJobs[0].state.data,
    options: failedJobs[0].state.options,
  });
}

await adminStore.deleteJob('job_123', 'default');
```

Notes:

- `retryJob()` only updates Redis state. Re-emit the job with `TaskManager.emit()`
  to actually process it.
- `deleteJob()` removes a job before it runs; treat it as a cancel action.

For full options and types, see the
[AdminStore API Reference](/reference/admin-store).

## Recommended dashboard sections

- **Queue health**: `JobStats` counts by status.
- **Job table**: filters for `status`, `queue`, and time range.
- **Job detail**: logs, errors, and retry history from `AdminJobData`.
- **Controls**: retry or delete jobs with clear guardrails.

## Next Steps

- Review the [AdminStore API](/reference/admin-store)
- Compare with [Task Management](/guide/task-management)
- Explore [Processor](/reference/processor) for handler policies
