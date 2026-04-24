# hound

Deno-native Redis job queue. Sorted-set delivery, crash recovery via Reaper,
cron scheduling, and a management API. Works with Redis (ioredis), InMemoryStorage, and Deno KV.

```ts
import { Hound } from '@hushkey/remq';

const hound = Hound.create({ db });

hound.on('email.send', async (ctx) => {
  await sendEmail(ctx.data.to);
});

await hound.start();
hound.emit('email.send', { to: 'leo@hushkey.jp' });
```

---

## Installation

```ts
import { Hound } from 'jsr:@hushkey/remq@^0.49.4';
```

---

## Creation

```ts
const hound = Hound.create(options); // creates singleton
const hound = Hound.getInstance();   // retrieves singleton
Hound._reset();                      // test use only
```

---

## Registration

```ts
// Inline
hound.on('property.sync', async (ctx) => {
  await sync(ctx.data);
}, { queue: 'sync', attempts: 3 });

// Type-safe via defineJob
const syncJob = defineJob<AppCtx, { propertyId: number }>({
  event: 'property.sync',
  handler: async (ctx) => {
    ctx.data.propertyId; // typed as number
  },
  options: { queue: 'sync', attempts: 3 },
});

hound.on(syncJob);
```

---

## Emission

```ts
// Fire and forget — returns jobId immediately
const jobId = hound.emit('property.sync', { propertyId: 1 });

// Awaitable — resolves when state key + queue entry are both written
const jobId = await hound.emitAsync('property.sync', { propertyId: 1 });
```

### Emit options

| Option         | Type                       | Description                                                 |
| -------------- | -------------------------- | ----------------------------------------------------------- |
| `queue`        | `string`                   | Target queue. Default `'default'`                           |
| `id`           | `string`                   | Explicit job ID. Defaults to FNV-1a hash of event + payload |
| `delay`        | `Date`                     | Don't process before this time                              |
| `attempts`     | `number`                   | Max retry attempts                                          |
| `retryDelayMs` | `number`                   | Delay between retries in ms. Default `1000`                 |
| `retryBackoff` | `'fixed' \| 'exponential'` | Backoff strategy. Default `'fixed'`                         |
| `repeat`       | `{ pattern: string }`      | Cron expression — makes job self-scheduling                 |
| `priority`     | `number`                   | Higher = processed first. Default `0`                       |

---

## Handler context

Every handler receives a typed `ctx` object:

```ts
hound.on('property.sync', async (ctx) => {
  ctx.id              // stable job ID
  ctx.name            // event name
  ctx.queue           // queue name
  ctx.data            // typed payload (via defineJob)
  ctx.retryCount      // remaining retries
  ctx.retriedAttempts // how many times retried so far
  ctx.logger('msg')   // sync logger — appended to job blob
  ctx.emit(...)       // fire and forget from handler
  ctx.emitAsync(...)  // awaitable emit from handler
  ctx.emitAndWait(...)// emit and block until the job completes
  ctx.socket.update() // WebSocket progress update (requires expose)
})
```

### Handler options

| Option         | Type                       | Description                       |
| -------------- | -------------------------- | --------------------------------- |
| `queue`        | `string`                   | Target queue. Default `'default'` |
| `attempts`     | `number`                   | Max retry attempts                |
| `repeat`       | `{ pattern: string }`      | Cron expression                   |
| `debounce`     | `number`                   | Debounce window in ms             |
| `retryBackoff` | `'fixed' \| 'exponential'` | Backoff strategy                  |

---

## Lifecycle

```ts
await hound.start(); // initialize crons, start processor and Reaper
await hound.stop();  // stop processor and Reaper, drain in-flight jobs, shut down WS gateway
await hound.drain(); // wait for all active jobs to complete
```

---

## Creation options

| Option        | Type                                        | Description                                              |
| ------------- | ------------------------------------------- | -------------------------------------------------------- |
| `db`          | `Redis \| InMemoryStorage \| DenoKvStorage` | Storage backend — state keys, sorted-set queues, locks   |
| `ctx`         | `TApp`                                      | App-level context injected into every handler as `ctx.*` |
| `concurrency` | `number`                                    | Max concurrent jobs across all queues. Default `1`       |
| `expose`      | `number`                                    | WebSocket gateway port for real-time job updates         |
| `debug`       | `boolean`                                   | Enable debug logging. Default `false`                    |

### Storage backends

```ts
import { Hound, InMemoryStorage, DenoKvStorage } from '@hushkey/remq';
import { Redis } from 'npm:ioredis';

// Redis (production)
const hound = Hound.create({ db: new Redis(REDIS_URL) });

// In-memory (testing / zero-dep local)
const hound = Hound.create({ db: new InMemoryStorage() });

// Deno KV
const hound = Hound.create({ db: await DenoKvStorage.open() });
```

### Processor options

| Option                          | Type                       | Description                                                                                  |
| ------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------- |
| `processor.jobStateTtlSeconds`  | `number`                   | State key TTL. Required in production — prevents unbounded key growth                        |
| `processor.maxLogsPerJob`       | `number`                   | Max log entries per job. Oldest removed first                                                |
| `processor.pollIntervalMs`      | `number`                   | Poll interval when queue is empty. Default `3000`                                            |
| `processor.visibilityTimeoutMs` | `number`                   | How long before a stalled job is reclaimed by the Reaper. Default `30000`                    |
| `processor.claimCount`          | `number`                   | Max jobs to claim per poll cycle. Default `200`                                              |
| `processor.queuePriority`       | `Record<string, number>`   | Poll order across queues. Lower = higher priority                                            |
| `processor.retry.retryDelayMs`  | `number`                   | Global retry delay override                                                                  |
| `processor.retry.retryBackoff`  | `'fixed' \| 'exponential'` | Global backoff override                                                                      |
| `processor.dlq.streamKey`       | `string`                   | Dead letter queue name                                                                       |

---

## Queue priority

Prevents queue starvation under load. Queues not in the map are polled last.

```ts
Hound.create({
  processor: {
    queuePriority: {
      payments: 1, // polled first
      sync: 2,     // polled second
      default: 3,  // polled last
    },
  },
});
```

---

## Cron scheduling

Jobs with a `repeat.pattern` are self-scheduling — after each execution the next tick is automatically queued. Cron state survives restart.

```ts
hound.on('reports.daily', async (ctx) => {
  await generateReport();
}, {
  queue: 'scheduled',
  repeat: { pattern: '0 9 * * *' }, // every day at 9am
});
```

---

## Retry and backoff

```ts
hound.emit('payment.process', { amount: 100 }, {
  attempts: 5,
  retryDelayMs: 1000,
  retryBackoff: 'exponential', // 1s, 2s, 4s, 8s, 16s — capped at 1hr
});
```

---

## WebSocket

```ts
// Server
Hound.create({ expose: 4000 });

// Handler — send progress updates to connected clients
hound.on('video.encode', async (ctx) => {
  await encodeChunk(1);
  ctx.socket.update({ progress: 33 });
  await encodeChunk(2);
  ctx.socket.update({ progress: 66 });
  await encodeChunk(3);
  ctx.socket.update({ progress: 100 });
});

// Client
const ws = new WebSocket('ws://localhost:4000');
ws.send(JSON.stringify({ event: 'video.encode', data: { id: 1 } }));
ws.onmessage = ({ data }) => console.log(JSON.parse(data));
// { type: 'queued', jobId: '...' }
// { type: 'job_update', progress: 33, ... }
// { type: 'job_finished', status: 'completed', ... }
```

---

## Management API

```ts
import { HoundManagement } from '@hushkey/remq';

const management = new HoundManagement({ db, hound });
```

### Jobs

```ts
await management.api.jobs.find(); // all jobs, most recent state per jobId
await management.api.jobs.get('default:jobId'); // single job by {queue}:{jobId}
await management.api.jobs.delete('default:jobId');
await management.api.jobs.promote('default:jobId'); // fire immediately
await management.api.jobs.pause('default:jobId'); // delay until Number.MAX_SAFE_INTEGER
```

### Queues

```ts
await management.api.queues.find(); // all queues including empty ones
await management.api.queues.pause('payments');
await management.api.queues.resume('payments');
await management.api.queues.reset('payments'); // flush all jobs + sorted sets
await management.api.queues.running('payments'); // true if active, false if paused
```

### Events

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

---

## Delivery guarantees

Hound uses Redis sorted sets for at-least-once delivery and a background **Reaper** for crash recovery.

- Jobs are written to `queues:{queue}:q` (ZADD, scored by `delayUntil`)
- When a worker claims a job, it is atomically moved to `queues:{queue}:processing` via a Lua script
- If the process crashes mid-job, the job remains in the processing set
- The **Reaper** runs every `visibilityTimeoutMs / 2` (min 5s) and re-enqueues any job that has been in the processing set longer than `visibilityTimeoutMs`
- ACK removes the job from the processing set after successful handler completion — no manual call needed

### Reaper

The Reaper is a background sweep that handles crash recovery. It starts automatically with `hound.start()` and stops with `hound.stop()`.

```ts
Hound.create({
  processor: {
    visibilityTimeoutMs: 60_000, // reclaim after 60s — set above your p99 job duration
  },
});
```

---

## Performance

| Metric                   | Streams (v0.49.3) | Sorted-set (v0.49.4) |
| ------------------------ | ----------------- | -------------------- |
| Throughput               | ~506 jobs/sec     | higher               |
| At-least-once delivery   | ✓                 | ✓                    |
| Crash recovery           | ✓ (XCLAIM / PEL)  | ✓ (Reaper)           |
| Exponential backoff      | ✓                 | ✓                    |
| Queue priority           | ✓                 | ✓                    |
| Cron restart reliability | ✓                 | ✓                    |
| Storage backends         | Redis only        | Redis, InMemory, KV  |
| Single connection needed | ✗ (db + streamdb) | ✓                    |

---

## License

MIT
