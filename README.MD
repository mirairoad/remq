# REMQ

Redis-backed job queue and scheduler for Deno.

## Installation

### Prerequisites

- Deno 2.5 or higher
- Redis server running

### Use in this repo (workspace)

Add the workspace import alias to your `deno.json`:

```json
{
  "imports": {
    "@core/": "./core/"
  }
}
```

Then import from the workspace package:

```typescript
import { TaskManager } from "@core/mod.ts";
```

### Published package (JSR/npm)

When REMQ is published, install it from JSR or npm:

```bash
deno add jsr:@remq/remq
# or
deno add npm:@remq/remq
```

Then import from the registry:

```typescript
import { TaskManager } from "jsr:@remq/remq";
```

## Documentation

- **VitePress docs** — [`www/docs/`](www/docs/) (guides, quick start, API reference)
- **Core libs** — [`core/libs/task-manager/README.md`](core/libs/task-manager/README.md) | [`core/libs/admin/README.md`](core/libs/admin/README.md) | [`core/libs/processor/README.md`](core/libs/processor/README.md) | [`core/libs/consumer/README.md`](core/libs/consumer/README.md)

## Up-and-running example

Minimal flow based on [`examples/remq.plugin.ts`](examples/remq.plugin.ts), [`examples/scheduler/onrequest.ts`](examples/scheduler/onrequest.ts), and [`examples/index.ts`](examples/index.ts):

```typescript
import { TaskManager } from "@core/mod.ts";
import { Redis } from "ioredis";

const redisOption = {
  host: "127.0.0.1",
  port: 6379,
  db: 1,
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
};

const db = new Redis(redisOption);
const streamdb = new Redis({ ...redisOption, db: redisOption.db + 1 });

const taskManager = TaskManager.init({
  db,
  streamdb,
  expose: 4000,
  ctx: {},
  concurrency: 1,
  processor: {
    retry: { maxRetries: 3, retryDelayMs: 1000 },
  },
});

taskManager.registerHandler({
  event: "on-request",
  handler: async (job) => {
    console.log("runs on request");
    console.log(job.data);
  },
  options: { attempts: 3 },
});

await taskManager.start();

taskManager.emit({
  event: "on-request",
  data: { name: "Jane Doe", email: "jane.doe@example.com" },
  options: { id: "onrequest" },
});
```

## Running the examples

Make sure Redis is running first (see Installation). From the repo root:

```bash
deno task dev
# or
deno run -A examples/index.ts
```

Examples in `examples/`:

| File | Description |
|------|-------------|
| [`remq.plugin.ts`](examples/remq.plugin.ts) | TaskManager setup (db, streamdb, ctx, processor options) |
| [`index.ts`](examples/index.ts) | Entry point — imports handlers, starts remq, emits test job |
| [`scheduler/start.ts`](examples/scheduler/start.ts) | Scheduler flow with cron pattern |
| [`scheduler/onrequest.ts`](examples/scheduler/onrequest.ts) | On-request handler with retries |
| [`crons/hello-world.ts`](examples/crons/hello-world.ts), [`crons/multi-jobs.ts`](examples/crons/multi-jobs.ts) | Cron jobs |
