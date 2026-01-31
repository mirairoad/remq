# PRD: VitePress Documentation Completion

Design is approved. Goal: **generate and complete the Markdown reference files** for the major APIs so VitePress can serve full API docs. Tasks below are scoped to the APIs in `core/types` and `core/libs` that matter for the docs.

---

## 1. VitePress config & nav

- [x] **1.1** Add Admin / AdminStore to reference sidebar in `www/docs/.vitepress/config.ts` (new item under API Reference linking to `/reference/admin-store`).
- [x] **1.2** Ensure reference index lists all four APIs: TaskManager, Consumer, Processor, AdminStore (update `www/docs/reference/index.md` if needed).

---

## 2. Task Manager API

**Source:** `core/types/task-manager.ts`, `core/libs/task-manager/task-manager.ts`

- [x] **2.1** Create or rewrite `www/docs/reference/task-manager.md` so it matches the real API (remove placeholder `schedule()`; document `TaskManager.init()`, `registerHandler()`, `emit` via context, and `start()` / lifecycle).
- [x] **2.2** Document **types**: `TaskHandler<T, D>`, `EmitFunction`, `TaskManagerOptions<T>`, `RegisterHandlerOptions<T, D>` (parameters, defaults, and where they are used).
- [x] **2.3** Document **emit options**: `event`, `queue`, `data`, and `options` (e.g. `id`, `priority`, `delayUntil`, `retryCount`, `retryDelayMs`, `repeat`, `attempts`, `debounce`) with short descriptions and examples where helpful.
- [x] **2.4** Add a minimal **code example** showing: `TaskManager.init()`, one `registerHandler()` call, and emitting a job from inside a handler or from outside.

---

## 3. Consumer API

**Source:** `core/types/consumer.ts`, `core/libs/consumer/consumer.ts`

- [x] **3.1** Rewrite `www/docs/reference/consumer.md` to reflect the actual Consumer: constructor with `ConsumerOptions`, `start()`, `stop()`, and event/handler-based flow (no fake `on('message')` if that’s not the real API).
- [x] **3.2** Document **ConsumerOptions** in full: `streams`, `streamdb`, `handler`, `concurrency`, `group`, `consumerId`, `pollIntervalMs`, `claim` (`minIdleMs`, `count`), `read` (`blockMs`, `count`) with types and defaults.
- [x] **3.3** Document the **MessageHandler** signature (from `core/types/message.ts`) as used by Consumer, and how it interacts with Consumer lifecycle.
- [x] **3.4** Add a minimal **code example**: building `ConsumerOptions`, creating a Consumer, and starting/stopping it.

---

## 4. Processor API

**Source:** `core/types/processor.ts`, `core/libs/processor/processor.ts`

- [x] **4.1** Rewrite `www/docs/reference/processor.md` so it describes Processor as the layer that wraps Consumer with retry, DLQ, and debounce (no placeholder `process(message)` if that’s not the public API).
- [x] **4.2** Document **ProcessorOptions**: `consumer`, `streamdb`, `retry`, `dlq`, `debounce`, `ignoreConfigErrors` and how they feed into the Processor.
- [x] **4.3** Document **RetryConfig**: `maxRetries`, `retryDelayMs`, `backoffMultiplier`, `shouldRetry` (and defaults).
- [x] **4.4** Document **DLQConfig**: `streamKey`, `shouldSendToDLQ` (and default behavior).
- [x] **4.5** Document **DebounceConfig** (and numeric shorthand): `debounce`, `keyFn` (and how Processor uses it).
- [x] **4.6** Document **ProcessableMessage** shape briefly (id, streamKey, data including delay/retry fields) so users know what the handler receives.
- [x] **4.7** Add a minimal **code example**: building Processor with Consumer options plus retry/DLQ/debounce, and starting it.

---

## 5. Admin Store API

**Source:** `core/libs/admin/admin-store.ts`, `core/types/admin.ts`

- [x] **5.1** Create `www/docs/reference/admin-store.md` and add it to the reference sidebar (see 1.1).
- [x] **5.2** Document **AdminStore** class: constructor (`db: RedisConnection`) and purpose (CRUD and control for admin UIs).
- [x] **5.3** Document **job methods**: `getJob(jobId, queue)`, `listJobs(options)`, `deleteJob(jobId, queue)` with params and return types; mention `ListJobsOptions` (`queue`, `status`, `limit`, `offset`).
- [x] **5.4** Document **queue methods**: `getQueueStats(queue)`, `getQueues()`, `getQueuesInfo()` and their return types (`JobStats`, `QueueInfo`).
- [x] **5.5** Document **control methods**: `retryJob(jobId, queue)`, `cancelJob(jobId, queue)`, `pauseQueue(queue)`, `resumeQueue(queue)`, `isQueuePaused(queue)`, `pauseJob(jobId, queue)`, `resumeJob(jobId, queue)` with behavior and errors (e.g. “only failed jobs can be retried”).
- [x] **5.6** Document **admin types**: `AdminJobData` (main fields: id, state, status, timestamps, logs, errors, paused), `ListJobsOptions`, `JobStats`, `QueueInfo` in a small “Types” subsection or table.
- [x] **5.7** Add a minimal **code example**: instantiating AdminStore and calling 2–3 methods (e.g. `getQueuesInfo()`, `listJobs()`, `retryJob()`).

---

## 6. Cross-links and consistency

- [x] **6.1** In each reference page, add “Next steps” or “See also” links to the other three APIs (TaskManager, Consumer, Processor, AdminStore) where relevant.
- [x] **6.2** Use consistent heading levels and optional frontmatter (e.g. `title`, `description`) so the sidebar and meta look consistent.
- [x] **6.3** Ensure all code snippets use the same language tag (`ts` or `typescript`) and are import-path accurate for the repo (e.g. from `@core/` or as in examples).

---

## Summary: what it takes for VitePress to “finish off”

1. **Config:** One sidebar update to add AdminStore; optionally touch reference index.
2. **Four reference MD files:**  
   - **Task Manager** – rewrite existing page to match real API + types + emit options + example.  
   - **Consumer** – rewrite existing page to match real API + full ConsumerOptions + handler signature + example.  
   - **Processor** – rewrite existing page to match real API + all option/config types + ProcessableMessage + example.  
   - **Admin Store** – new page + types subsection + job/queue/control methods + example.
3. **Cross-links and style** – “See also” between reference pages and consistent headings/code style.

No design or theme changes required; only the Markdown content and one config change.
