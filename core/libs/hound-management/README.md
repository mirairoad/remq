# HoundManagement

Queue and job administration. List jobs, inspect state, pause/resume queues,
promote or delete jobs, and subscribe to completion events.

## Setup

```ts
import { Hound, HoundManagement } from '@hushkey/remq';

const hound = Hound.create({ db });
const management = new HoundManagement({ db, hound });
```

`hound` is optional — only required for `management.events` and `management.api.jobs.promote`.

## Jobs API

```ts
// List all jobs (most recent state per jobId)
const jobs = await management.api.jobs.find();

// Get single job by {queue}:{jobId}
const job = await management.api.jobs.get('default:job-id-123');

// Delete a job (all state keys)
await management.api.jobs.delete('default:job-id-123');

// Promote — fire immediately (moves score to now)
await management.api.jobs.promote('default:job-id-123');

// Pause — delay until Number.MAX_SAFE_INTEGER
await management.api.jobs.pause('default:job-id-123');
```

## Queues API

```ts
// List all queues with pause state and length
const queues = await management.api.queues.find();

await management.api.queues.pause('payments');
await management.api.queues.resume('payments');

// Flush all jobs and sorted sets for a queue
await management.api.queues.reset('payments');

// Check if queue is running
const active = await management.api.queues.running('payments'); // true | false
```

## Events

Requires a `Hound` instance to be passed to the constructor.

```ts
// All terminal events
const unsub = management.events.job.finished((p) => {
  console.log(p.jobId, p.status, p.error);
});

// Filtered
management.events.job.completed((p) => notifyClient(p.jobId));
management.events.job.failed((p) => alertOncall(p.error));

// Unsubscribe
unsub();
```

## Types

```ts
interface JobRecord {
  id: string;
  queue: string;
  status: 'waiting' | 'delayed' | 'processing' | 'completed' | 'failed';
  name: string;
  data: unknown;
  retryCount: number;
  retriedAttempts: number;
  priority: number;
  delayUntil: number;
  logs: { message: string; timestamp: number }[];
  errors: { message: string; stack?: string; timestamp: number }[];
  timestamp: number;
  lastRun?: number;
}

interface QueueRecord {
  name: string;
  paused: boolean;
  length: number;
}
```
