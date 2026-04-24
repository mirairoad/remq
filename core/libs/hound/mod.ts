/**
 * Hound — high-level public API for job management (singleton lifecycle, handlers, emit, start/stop).
 * Built on Processor → Consumer → QueueStore.
 *
 * @module
 */
import { Processor } from '../processor/processor.ts';
import { DebounceManager } from '../processor/debounce-manager.ts';
import { QueueStore } from '../consumer/queue-store.ts';
import { Reaper } from '../consumer/reaper.ts';
import { createGateway } from '../gateways/gateway.ts';
import { debug } from '../../utils/logger.ts';
import type {
  BenchmarkOptions,
  BenchmarkResult,
  EmitAndWaitFunction,
  EmitAsyncFunction,
  EmitFunction,
  EmitOptions,
  HandlerOptions,
  JobData,
  JobDefinition,
  JobHandler,
  HoundOptions,
  JobSocketContext,
  Message,
  MessageContext,
  ProcessableMessage,
  RedisConnection,
} from '../../types/index.ts';
import {
  genExecId,
  genJobIdSync,
  parseCronExpression,
} from '../../utils/index.ts';

/** Re-exported option and handler types for Hound. */
export type {
  BenchmarkOptions,
  BenchmarkResult,
  EmitAndWaitFunction,
  EmitAsyncFunction,
  EmitFunction,
  EmitOptions,
  HandlerOptions,
  JobContext,
  JobDefinition,
  JobHandler,
  HoundOptions,
} from '../../types/index.ts';

/** Symbol for internal subscription. Not part of public API. */
export const SUBSCRIBE_JOB_FINISHED = Symbol.for('hound.subscribeJobFinished');

export class Hound<
  TApp extends Record<string, unknown> = Record<string, unknown>,
> {
  private static instance: Hound<any>;

  private readonly db: RedisConnection;
  private readonly queueStore: QueueStore;
  private readonly ctx: TApp & {
    emit: EmitFunction;
    emitAsync: EmitAsyncFunction;
  };
  private readonly concurrency: number;
  private readonly processorOptions: HoundOptions<TApp>['processor'];
  private readonly importMeta?: { url: string };
  private readonly jobDirs?: string[];
  // Monotonic counter assigned synchronously at emit time so rapid fire-and-forget
  // emits within the same millisecond are enqueued in call order, not async-resolution order.
  #emitSeq = 0;

  private handlers: Map<string, JobHandler<TApp, any>> = new Map();
  private handlerDebounce: Map<string, DebounceManager> = new Map();
  private handlerSemaphores: Map<string, { limit: number; active: number }> = new Map();
  private pendingCronJobs: Map<
    string,
    {
      event: string;
      queue: string;
      repeat: { pattern: string };
      attempts?: number;
    }
  > = new Map();
  private processor?: Processor;
  private reaper?: Reaper;
  private queues: Set<string> = new Set();
  private isStarted = false;
  private shutdownRegistered = false;
  private readonly expose?: number;
  private readonly auth?: string;
  private server?: ReturnType<typeof createGateway>;

  readonly #jobFinishedListeners = new Set<
    (payload: {
      jobId: string;
      queue: string;
      status: 'completed' | 'failed';
      error?: string;
    }) => void
  >();
  readonly #jobWaiters = new Map<string, {
    resolve: (jobId: string) => void;
    reject: (err: Error) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  #jobWaiterListenerActive = false;

  private readonly JOB_STATUS_MESSAGES = {
    processing: 'Job execution started',
    completed: 'Job completed successfully',
    delayed: (date: string) => `Job delayed until ${date}`,
    waiting: 'Job queued and waiting to be processed',
    failed: (error: string) => `Job failed: ${error}`,
  };

  private constructor(options: HoundOptions<TApp>) {
    this.db = options.db;
    this.queueStore = new QueueStore(this.db);
    this.concurrency = options.concurrency ?? 1;
    this.processorOptions = options.processor || {};

    this.ctx = {
      ...(options.ctx || {} as TApp),
      emit: this.emit.bind(this),
      emitAsync: this.emitAsync.bind(this),
      emitAndWait: this.emitAndWait.bind(this),
    } as TApp & { emit: EmitFunction; emitAsync: EmitAsyncFunction; emitAndWait: EmitAndWaitFunction };

    this.expose = options.expose;
    this.auth = options.auth;
    this.importMeta = options.importMeta;
    this.jobDirs = options.jobDirs;
  }

  static create<TApp extends Record<string, unknown> = Record<string, unknown>>(
    options: HoundOptions<TApp>,
  ): Hound<TApp> {
    const g = globalThis as Record<string, unknown>;
    if (g['__hound_instance__']) {
      Hound.instance = g['__hound_instance__'] as Hound<TApp>;
      return Hound.instance;
    }
    Hound.instance = new Hound(options);
    g['__hound_instance__'] = Hound.instance;
    return Hound.instance as Hound<TApp>;
  }

  /** Reset singleton — test use only. */
  static _reset(): void {
    Hound.instance = undefined as any;
    (globalThis as Record<string, unknown>)['__hound_instance__'] = undefined;
  }

  static getInstance<
    TApp extends Record<string, unknown> = Record<string, unknown>,
  >(): Hound<TApp> {
    return Hound.instance as Hound<TApp>;
  }

  // ─── Handler registration ─────────────────────────────────────────────────

  on<D = unknown>(
    eventOrDefinition: string | JobDefinition<TApp, D>,
    handler?: JobHandler<TApp, D>,
    options?: HandlerOptions,
  ): this {
    let event: string;
    let h: JobHandler<TApp, D>;
    let opts: HandlerOptions | undefined;

    if (typeof eventOrDefinition === 'object') {
      event = eventOrDefinition.event;
      h = eventOrDefinition.handler;
      opts = eventOrDefinition.options;
    } else {
      event = eventOrDefinition;
      h = handler!;
      opts = options;
    }

    if (!event) throw new Error('event is required');
    if (!h) throw new Error('handler is required');

    const queue = opts?.queue ?? 'default';
    const handlerKey = `${queue}:${event}`;

    // Enforce unique event names — same event on a different queue is a config error.
    for (const key of this.handlers.keys()) {
      const colonIdx = key.indexOf(':');
      if (key.slice(colonIdx + 1) === event && key !== handlerKey) {
        throw new Error(
          `[hound] Duplicate event name '${event}': already registered on queue '${key.slice(0, colonIdx)}'. ` +
            `Event names must be unique across all queues.`,
        );
      }
    }

    this.handlers.set(handlerKey, h as JobHandler<TApp, any>);
    this.queues.add(queue);

    if (opts?.concurrency !== undefined && opts.concurrency > 0) {
      this.handlerSemaphores.set(handlerKey, { limit: opts.concurrency, active: 0 });
    }

    if (opts?.debounce !== undefined) {
      const debounceSeconds = Math.ceil(opts.debounce / 1000);
      this.handlerDebounce.set(handlerKey, new DebounceManager(debounceSeconds, undefined));
    }

    if (opts?.repeat?.pattern) {
      this.pendingCronJobs.set(handlerKey, {
        event,
        queue,
        repeat: { pattern: opts.repeat.pattern },
        attempts: opts.attempts,
      });
    }

    return this;
  }

  // ─── Emission ─────────────────────────────────────────────────────────────

  /** Return the queue a handler was registered on for `event`, or undefined. */
  #resolveQueue(event: string): string | undefined {
    for (const key of this.handlers.keys()) {
      const colonIdx = key.indexOf(':');
      if (key.slice(colonIdx + 1) === event) return key.slice(0, colonIdx);
    }
    return undefined;
  }

  #buildPayload(
    event: string,
    data?: unknown,
    options?: EmitOptions,
  ): [string, string, string, string, number] {
    const opts = options ?? {};
    const queue = opts.queue || this.#resolveQueue(event) || 'default';
    const payload = data ?? {};

    if (!event) throw new Error('event is required');

    const jobId = opts.id ?? genJobIdSync(event, payload);

    let delayUntil: Date | number = opts.delay ?? new Date();
    if (opts.delay) {
      delayUntil = opts.delay;
    } else if (opts.repeat?.pattern) {
      delayUntil = parseCronExpression(opts.repeat.pattern).getNextDate(new Date());
    }

    const delayUntilMs = delayUntil instanceof Date ? delayUntil.getTime() : delayUntil;

    const jobData: JobData = {
      id: jobId,
      state: {
        name: event,
        queue,
        data: payload,
        options: opts,
      },
      status: opts.repeat?.pattern ? 'delayed' : 'waiting',
      delayUntil: delayUntilMs,
      lockUntil: Date.now(),
      priority: opts.priority ?? 0,
      retryCount: opts.retryCount ?? (opts.attempts ?? 0),
      retryDelayMs: opts.retryDelayMs ?? 1000,
      retryBackoff: opts.retryBackoff ?? 'fixed',
      retriedAttempts: 0,
      repeatCount: opts.repeat?.pattern ? 1 : 0,
      repeatDelayMs: 0,
      logs: [{ message: 'Added to the queue', timestamp: Date.now() }],
      errors: [],
      timestamp: Date.now(),
    };

    const stateKey = `queues:${queue}:${jobId}:${jobData.status}`;
    const dataJson = JSON.stringify(jobData);

    // Score: delayUntil adjusted by priority, plus a sub-millisecond sequence tiebreaker
    // assigned synchronously so rapid emit() calls preserve call order regardless of
    // async-resolution timing. Max drift: 1ms per 10,000 jobs.
    const seq = this.#emitSeq++;
    const score = delayUntilMs - (opts.priority ?? 0) + (seq % 10_000) * 0.0001;

    return [jobId, queue, stateKey, dataJson, score];
  }

  emit(event: string, data?: unknown, options?: EmitOptions): string {
    const [jobId, queue, stateKey, dataJson, score] = this.#buildPayload(event, data, options);

    this.#setJobState(stateKey, dataJson)
      .then(() => this.queueStore.enqueue(queue, jobId, score))
      .catch((err: unknown) => {
        console.error(` emit failed for ${event}:`, err);
      });

    return jobId;
  }

  async emitAsync(event: string, data?: unknown, options?: EmitOptions): Promise<string> {
    const [jobId, queue, stateKey, dataJson, score] = this.#buildPayload(event, data, options);

    await this.#setJobState(stateKey, dataJson);
    await this.queueStore.enqueue(queue, jobId, score);

    return jobId;
  }

  #ensureJobWaiterListener(): void {
    if (this.#jobWaiterListenerActive) return;
    this.#jobWaiterListenerActive = true;
    this[SUBSCRIBE_JOB_FINISHED](({ jobId, status, error }) => {
      const entry = this.#jobWaiters.get(jobId);
      if (!entry) return;
      this.#jobWaiters.delete(jobId);
      clearTimeout(entry.timer);
      if (status === 'failed') entry.reject(new Error(error ?? 'Job failed'));
      else entry.resolve(jobId);
    });
  }

  async emitAndWait(
    event: string,
    data?: unknown,
    options?: EmitOptions & { timeoutMs?: number },
  ): Promise<string> {
    this.#ensureJobWaiterListener();
    const { timeoutMs = 30_000, ...emitOpts } = options ?? {};
    const jobId = emitOpts.id ?? genJobIdSync(event, data ?? {});

    const waitPromise = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.#jobWaiters.delete(jobId);
        reject(new Error(`Job ${jobId} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.#jobWaiters.set(jobId, { resolve, reject, timer });
    });

    this.emit(event, data, { ...emitOpts, id: jobId });
    return waitPromise;
  }

  async benchmark(config: BenchmarkOptions): Promise<BenchmarkResult> {
    const { totalJobs, simulatedWorkMs = 0, concurrency = 10, timeoutMs = 30_000 } = config;
    const BENCH_EVENT = '__hound.benchmark__';
    const BENCH_QUEUE = 'default';
    const handlerKey = `${BENCH_QUEUE}:${BENCH_EVENT}`;

    const needsRestart = !this.queues.has(BENCH_QUEUE);
    this.on(BENCH_EVENT, async () => {
      if (simulatedWorkMs > 0) await new Promise<void>((r) => setTimeout(r, simulatedWorkMs));
    });
    if (needsRestart) {
      this.isStarted = false;
      await this.start();
    }

    this.#ensureJobWaiterListener();

    const latencies: number[] = [];
    const startTime = performance.now();
    let jobIndex = 0;

    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (true) {
          const i = jobIndex++;
          if (i >= totalJobs) break;
          const id = `__bench__${i}__${crypto.randomUUID()}`;
          const t = performance.now();
          await this.emitAndWait(BENCH_EVENT, { simulatedWorkMs }, { queue: BENCH_QUEUE, id, timeoutMs });
          latencies.push(performance.now() - t);
        }
      }),
    );

    const durationMs = performance.now() - startTime;
    this.handlers.delete(handlerKey);

    const sorted = [...latencies].sort((a, b) => a - b);
    const n = sorted.length;
    const result: BenchmarkResult = {
      totalJobs: n,
      durationMs,
      throughput: n / (durationMs / 1000),
      latency: {
        min: sorted[0] ?? 0,
        max: sorted[n - 1] ?? 0,
        p50: sorted[Math.floor(n * 0.5)] ?? 0,
        p95: sorted[Math.floor(n * 0.95)] ?? 0,
        p99: sorted[Math.floor(n * 0.99)] ?? 0,
        avg: latencies.reduce((s, l) => s + l, 0) / n,
      },
    };

    console.log(`
Benchmark Results
${'─'.repeat(40)}
  Total:      ${result.totalJobs} jobs
  Duration:   ${(result.durationMs / 1000).toFixed(2)}s
  Throughput: ${result.throughput.toFixed(2)} jobs/s
  Latency:
    min: ${result.latency.min.toFixed(2)}ms
    p50: ${result.latency.p50.toFixed(2)}ms
    p95: ${result.latency.p95.toFixed(2)}ms
    p99: ${result.latency.p99.toFixed(2)}ms
    max: ${result.latency.max.toFixed(2)}ms
    avg: ${result.latency.avg.toFixed(2)}ms
`);

    return result;
  }

  /** Enqueue an existing job payload directly (used by HoundManagement.promoteJob). */
  async enqueueJob(queue: string, jobPayload: Record<string, unknown>): Promise<void> {
    const jobId = jobPayload.id as string;
    const score = (jobPayload.delayUntil as number ?? Date.now()) - ((jobPayload.priority as number) ?? 0);
    await this.queueStore.enqueue(queue, jobId, score);
  }

  // ─── Job finished listeners ───────────────────────────────────────────────

  [SUBSCRIBE_JOB_FINISHED](
    cb: (payload: {
      jobId: string;
      queue: string;
      status: 'completed' | 'failed';
      error?: string;
    }) => void,
  ): () => void {
    this.#jobFinishedListeners.add(cb);
    return () => this.#jobFinishedListeners.delete(cb);
  }

  #notifyJobFinished(payload: {
    jobId: string;
    queue: string;
    status: 'completed' | 'failed';
    error?: string;
  }): void {
    for (const cb of this.#jobFinishedListeners) {
      try {
        cb(payload);
      } catch (err) {
        console.error(' jobFinished listener error:', err);
      }
    }
  }

  // ─── Redis primitives ─────────────────────────────────────────────────────

  async #setJobState(key: string, value: string): Promise<void> {
    const ttl = this.processorOptions?.jobStateTtlSeconds;
    if (typeof ttl === 'number' && ttl > 0) {
      await this.db.set(key, value, 'EX', ttl);
    } else {
      await this.db.set(key, value);
    }
  }

  /** Pipeline DEL old key + SET new key in one round trip. */
  private async transitionState(delKey: string, setKey: string, value: string): Promise<void> {
    const ttl = this.processorOptions?.jobStateTtlSeconds;
    const pipe = this.db.pipeline();
    pipe.del(delKey);
    if (typeof ttl === 'number' && ttl > 0) {
      pipe.set(setKey, value, 'EX', ttl);
    } else {
      pipe.set(setKey, value);
    }
    await pipe.exec();
  }

  #trimLogs(jobEntry: { logs?: unknown[] }): void {
    const max = this.processorOptions?.maxLogsPerJob;
    if (
      typeof max !== 'number' ||
      max <= 0 ||
      !jobEntry.logs?.length ||
      jobEntry.logs.length <= max
    ) return;
    jobEntry.logs.splice(0, jobEntry.logs.length - max);
  }

  // ─── Auto-discovery ──────────────────────────────────────────────────────

  async #autoRegisterJobs(): Promise<void> {
    if (!this.importMeta || !this.jobDirs?.length) return;
    const base = new URL('.', this.importMeta.url);

    for (const dir of this.jobDirs) {
      const dirPath = new URL(dir.endsWith('/') ? dir : dir + '/', base).pathname;
      try {
        for await (const entry of this.#walkJobFiles(dirPath)) {
          try {
            const mod = await import(`file://${entry}`);
            for (const value of Object.values(mod)) {
              if (this.#isJobDefinition(value)) {
                this.on(value as JobDefinition<TApp, unknown>);
              }
            }
          } catch (err) {
            console.error(`[hound] Auto-register failed for ${entry}:`, err);
          }
        }
      } catch (err) {
        if (!(err instanceof Deno.errors.NotFound)) throw err;
        console.warn(`[hound] jobDir not found, skipping: ${dirPath}`);
      }
    }
  }

  async *#walkJobFiles(dir: string): AsyncGenerator<string> {
    for await (const entry of Deno.readDir(dir)) {
      const path = `${dir}/${entry.name}`;
      if (entry.isDirectory) yield* this.#walkJobFiles(path);
      else if (entry.isFile && entry.name.endsWith('.job.ts')) yield path;
    }
  }

  #isJobDefinition(v: unknown): boolean {
    return (
      typeof v === 'object' &&
      v !== null &&
      'event' in v &&
      'handler' in v &&
      typeof (v as Record<string, unknown>).event === 'string' &&
      typeof (v as Record<string, unknown>).handler === 'function'
    );
  }

  // ─── Start ────────────────────────────────────────────────────────────────

  async start(): Promise<this> {
    if (this.isStarted) return this;

    await this.#autoRegisterJobs();

    if (this.processor) {
      this.processor.stop();
      await this.drain();
    }

    // Cron dedup — simplified: check state key, no stream scan needed
    for (const [, { event, queue, repeat, attempts }] of this.pendingCronJobs) {
      const jobId = genJobIdSync(event, {});

      // Check if already scheduled (delayed state key exists)
      const delayedKey = `queues:${queue}:${jobId}:delayed`;
      const existingData = await this.db.get(delayedKey);

      if (existingData) {
        try {
          const existing = JSON.parse(existingData);
          // Re-add to queue in case the sorted set was flushed (restart safety)
          const score = (existing.delayUntil ?? Date.now()) - (existing.priority ?? 0);
          await this.queueStore.enqueue(queue, jobId, score);
          debug(` cron ${event}: re-registered with delayUntil=${existing.delayUntil}`);
        } catch {
          // Corrupt state — emit fresh
          await this.emitAsync(event, {}, { queue, repeat, attempts });
        }
      } else {
        // Check processing set — Reaper will handle it if it's there
        const inProcessing = await this.db.zscore(`queues:${queue}:processing`, jobId);
        if (!inProcessing) {
          // Not scheduled anywhere — emit fresh
          await this.emitAsync(event, {}, { queue, repeat, attempts });
          debug(` cron ${event}: emitted fresh`);
        } else {
          debug(` cron ${event}: found in processing set, Reaper will reclaim if stalled`);
        }
      }
    }

    this.#createUnifiedProcessor();

    if (this.processor) {
      this.processor.start().catch((err) => {
        console.error(' Error starting processor:', err);
      });
    }

    // Start Reaper
    const allQueues = Array.from(this.queues);
    this.reaper = new Reaper({
      db: this.db,
      queues: allQueues,
      visibilityTimeoutMs: this.processorOptions?.visibilityTimeoutMs,
    });
    this.reaper.start();

    this.isStarted = true;
    this.#setupGracefulShutdown();

    if (this.expose != null) {
      this.server = createGateway({ port: this.expose, hound: this, auth: this.auth });
      debug(`Hound HTTP gateway listening on 0.0.0.0:${this.expose}`);
    }

    const queueList = Array.from(this.queues).join(', ');
    debug(`Hound started with ${this.queues.size} queue(s) [${queueList}] and concurrency ${this.concurrency}`);
    return this;
  }

  // ─── Stop / drain ─────────────────────────────────────────────────────────

  async stop(): Promise<void> {
    this.reaper?.stop();
    this.reaper = undefined;

    this.processor?.stop();

    if (this.server) {
      await Promise.race([
        this.server.shutdown(),
        new Promise<void>((resolve) => setTimeout(resolve, 2000)),
      ]);
      this.server = undefined;
    }

    this.isStarted = false;
  }

  async drain(): Promise<void> {
    if (this.processor) {
      await this.processor.waitForActiveJobs();
    }
  }

  // ─── Processor creation ───────────────────────────────────────────────────

  #createUnifiedProcessor(): void {
    const allQueues = Array.from(this.queues);

    const queuePriority: Record<string, number> = {};
    const userPriority = this.processorOptions?.queuePriority ?? {};
    for (const [queue, priority] of Object.entries(userPriority)) {
      queuePriority[queue] = priority;
    }

    const unifiedHandler = async (
      message: Message,
      ctx: MessageContext,
    ): Promise<void> => {
      const msg = message as unknown as ProcessableMessage;
      const jobData = msg.data;

      if (!jobData?.state?.name || !jobData?.state?.queue) {
        throw new Error(' Invalid job data: missing state.name or state.queue');
      }

      const queueName = jobData.state.queue;
      const jobName = jobData.state.name!;
      const handlerKey = `${queueName}:${jobName}`;
      const jobId = jobData.id || msg.id;

      // Pipeline pause check + job state check
      const pipe = this.db.pipeline();
      pipe.get(`queues:${queueName}:paused`);
      pipe.get(`queues:${queueName}:${jobId}:${jobData.status || 'waiting'}`);
      const [[, isPaused], [, jobStatusData]] = (await pipe.exec()) as [
        [Error | null, string | null],
        [Error | null, string | null],
      ];

      // Queue paused — leave in processing set, don't ACK
      if (isPaused === 'true') return;

      if (jobStatusData) {
        try {
          const parsed = JSON.parse(jobStatusData) as {
            status?: string;
            paused?: boolean;
          };
          if (parsed.status === 'completed' || parsed.status === 'failed') {
            await ctx.ack();
            return;
          }
          if (parsed.paused === true) return;
        } catch {
          // Unparseable state — continue processing
        }
      }

      const handler = this.handlers.get(handlerKey);
      if (!handler) {
        throw new Error(
          ` No handler for queue: ${queueName}, event: ${jobName}. ` +
            `Registered: ${Array.from(this.handlers.keys()).join(', ')}`,
        );
      }

      const debounceManager = this.handlerDebounce.get(handlerKey);

      // Per-handler concurrency — requeue if slot is full so the consumer slot is freed.
      // Preserve original score (delayUntil - priority) + delay to maintain emission order.
      const sem = this.handlerSemaphores.get(handlerKey);
      if (sem && sem.active >= sem.limit) {
        const requeueDelay = this.processorOptions?.pollIntervalMs ?? 3000;
        const originalScore = (jobData.delayUntil ?? Date.now()) - (jobData.priority ?? 0);
        await ctx.ack();
        await this.queueStore.enqueue(queueName, jobId, originalScore + requeueDelay);
        return;
      }

      if (sem) sem.active++;
      try {
        if (debounceManager) {
          if (!debounceManager.shouldProcess(msg as any)) {
            await ctx.ack();
            return;
          }
          const originalHandler = handler;
          const wrappedHandler = async (c: any) => {
            await originalHandler(c);
            debounceManager.markProcessed(msg as any);
          };
          await this.#processJob(jobData, jobId, queueName, wrappedHandler, ctx);
        } else {
          await this.#processJob(jobData, jobId, queueName, handler, ctx);
        }
      } finally {
        if (sem) sem.active--;
      }
    };

    this.processor = new Processor({
      consumer: {
        queues: allQueues,
        db: this.db,
        handler: unifiedHandler,
        concurrency: this.concurrency,
        pollIntervalMs: this.processorOptions?.pollIntervalMs,
        visibilityTimeoutMs: this.processorOptions?.visibilityTimeoutMs,
        queuePriority,
        claimCount: this.processorOptions?.claimCount,
      },
      db: this.db,
      ...this.processorOptions,
    });
  }

  // ─── Job processing ───────────────────────────────────────────────────────

  async #processJob(
    jobEntry: any,
    jobId: string,
    queueName: string,
    handler: JobHandler<TApp, any>,
    _ctx: MessageContext,
  ): Promise<void> {
    try {
      if (!jobEntry.logs) jobEntry.logs = [];

      if (!jobEntry.logger) {
        jobEntry.logger = (message: string | object) => {
          jobEntry.logs?.push({
            message: typeof message === 'string' ? message : JSON.stringify(message),
            timestamp: Date.now(),
          });
          this.#trimLogs(jobEntry);
        };
      }

      if (
        jobEntry.status !== 'processing' &&
        !jobEntry.logs.find((l: any) => l.message === this.JOB_STATUS_MESSAGES.processing)
      ) {
        jobEntry.logs.push({ message: this.JOB_STATUS_MESSAGES.processing, timestamp: Date.now() });
        this.#trimLogs(jobEntry);
      }

      const processingData = { ...jobEntry, lastRun: Date.now(), status: 'processing' };
      const oldKey = `queues:${queueName}:${jobId}:${jobEntry.status}`;
      const processingKey = `queues:${queueName}:${jobId}:processing`;

      await this.transitionState(oldKey, processingKey, JSON.stringify(processingData));

      const handlerCtx = {
        ...this.ctx,
        id: jobId,
        name: jobEntry.state.name!,
        queue: jobEntry.state.queue!,
        status: 'processing',
        retryCount: jobEntry.retryCount ?? 0,
        retriedAttempts: jobEntry.retriedAttempts ?? 0,
        data: jobEntry.state.data,
        logger: jobEntry.logger,
        emit: this.emit.bind(this),
        emitAsync: this.emitAsync.bind(this),
        emitAndWait: this.emitAndWait.bind(this),
        socket: this.#createSocketContext(jobId, jobEntry.state.name!, jobEntry.state.queue!),
      };

      // Cron dedup lock — prevents double execution on restart recovery
      const cronPattern = jobEntry?.state?.options?.repeat?.pattern;
      if (cronPattern && jobEntry.repeatCount) {
        const cronExecLockKey = `queues:${queueName}:cron-exec:${jobId}:${jobEntry.delayUntil}`;
        const lockTtl = this.processorOptions?.jobStateTtlSeconds ?? 3600;
        const acquired = await this.db.set(cronExecLockKey, '1', 'EX', lockTtl, 'NX');
        if (!acquired) {
          await _ctx.ack();
          return;
        }
      }

      await handler(handlerCtx);

      const completedData = {
        ...processingData,
        logs: [
          ...(processingData.logs || []),
          { message: this.JOB_STATUS_MESSAGES.completed, timestamp: Date.now() },
        ],
        status: 'completed',
      };
      this.#trimLogs(completedData);

      const execId = genExecId();
      const completedKey = `queues:${queueName}:${jobId}:completed:${execId}`;
      await this.transitionState(processingKey, completedKey, JSON.stringify(completedData));

      this.#notifyJobFinished({ jobId, queue: queueName, status: 'completed' });

      await this.#scheduleCronNextTick(jobEntry, queueName);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      const failedData = {
        ...jobEntry,
        status: 'failed',
        timestamp: Date.now(),
        errors: [{
          message: errorMessage,
          stack: error instanceof Error ? error.stack : undefined,
          timestamp: Date.now(),
        }],
      };
      this.#trimLogs(failedData);

      const execId = genExecId();
      const failedKey = `queues:${queueName}:${jobEntry.id}:failed:${execId}`;
      const processingKey = `queues:${queueName}:${jobId}:processing`;
      await this.transitionState(processingKey, failedKey, JSON.stringify(failedData));

      const isConfigError = errorMessage.includes('No handler found') ||
        errorMessage.includes('No handlers registered') ||
        errorMessage.includes('is undefined');

      const willRetry = jobEntry.retryCount > 0 && !isConfigError;
      if (!willRetry) {
        this.#notifyJobFinished({ jobId: jobEntry.id, queue: queueName, status: 'failed', error: errorMessage });
      }

      await this.#scheduleCronNextTick(jobEntry, queueName);
      throw error;
    }
  }

  // ─── Cron scheduling ──────────────────────────────────────────────────────

  async #scheduleCronNextTick(
    jobEntry: Record<string, unknown>,
    queueName: string,
  ): Promise<void> {
    const state = jobEntry?.state as {
      name?: string;
      options?: { repeat?: { pattern?: string } };
    } | undefined;
    const pattern = state?.options?.repeat?.pattern;
    if (!jobEntry.repeatCount || !pattern) return;

    const cron = parseCronExpression(pattern);
    const nextRun = cron.getNextDate(new Date()).getTime();
    const lockKey = `queues:${queueName}:cron-lock:${state?.name ?? ''}`;
    const intervalMs = nextRun - Date.now();
    const lockTtl = Math.max(1, Math.ceil(intervalMs * 0.9 / 1000));

    const locked = await this.db.set(lockKey, '1', 'EX', lockTtl, 'NX');
    if (!locked) return;

    const nextJobData = {
      ...jobEntry,
      lockUntil: nextRun,
      delayUntil: nextRun,
      repeatCount: jobEntry.repeatCount,
      timestamp: Date.now(),
      status: 'delayed',
      lastRun: Date.now(),
    };

    const jobId = (jobEntry.id ?? '') as string;
    const stateKey = `queues:${queueName}:${jobId}:delayed`;
    const score = nextRun - ((jobEntry.priority as number) ?? 0);

    await this.#setJobState(stateKey, JSON.stringify(nextJobData));
    await this.queueStore.enqueue(queueName, jobId, score);
  }

  // ─── Socket context (stub) ────────────────────────────────────────────────

  #createSocketContext(_id: string, _event: string, _queue: string): JobSocketContext {
    return {
      update: () => {
        throw new Error('ctx.socket.update() is not supported — use emitAndWait or poll job state.');
      },
    };
  }

  // ─── Graceful shutdown ────────────────────────────────────────────────────

  #setupGracefulShutdown(): void {
    if (this.shutdownRegistered) return;
    this.shutdownRegistered = true;

    const shutdown = async (signal: string) => {
      debug(`Received ${signal}, shutting down gracefully...`);
      await Promise.race([this.stop(), new Promise<void>((r) => setTimeout(r, 3000))]);
      // Disconnect Redis so the ioredis TCP socket doesn't keep the event loop alive.
      // After this, the event loop drains naturally and the process exits on its own —
      // which is what the Deno watcher expects to trigger a restart.
      try { this.db.disconnect(); } catch { /* ignore */ }
      debug('Shutdown complete');
      // SIGINT = user pressed Ctrl+C → force exit immediately.
      // SIGTERM = watcher restart or Docker stop → let event loop drain so watcher can restart.
      if (signal === 'SIGINT') {
        if (typeof Deno !== 'undefined') {
          // @ts-ignore
          Deno.exit(0);
        } else if (typeof process !== 'undefined') {
          // @ts-ignore
          process.exit(0);
        }
      }
    };

    if (typeof Deno !== 'undefined') {
      // @ts-ignore
      Deno.addSignalListener('SIGINT', () => shutdown('SIGINT'));
      // @ts-ignore
      Deno.addSignalListener('SIGTERM', () => shutdown('SIGTERM'));
    } else if (typeof process !== 'undefined') {
      // @ts-ignore
      process.on('SIGINT', () => shutdown('SIGINT'));
      // @ts-ignore
      process.on('SIGTERM', () => shutdown('SIGTERM'));
    }
  }
}
