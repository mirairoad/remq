import { Processor } from '../processor/processor.ts';
import { DebounceManager } from '../processor/debounce-manager.ts';
import { createWsGateway } from '../gateways/ws.gateway.ts';
import type {
  EmitFunction,
  Message,
  MessageContext,
  ProcessableMessage,
  RedisConnection,
  TaskHandler,
  TaskManagerOptions,
  UpdateFunction,
} from '../../types/index.ts';
import { genJobIdSync } from './utils.ts';
import { parseCronExpression } from 'cron-schedule';

/**
 * TaskManager - High-level API for managing tasks/jobs
 *
 * Based on old worker's robust processJob logic with cleaner naming
 */
export class TaskManager<T = unknown> {
  private static instance: TaskManager<any>;

  private readonly db: RedisConnection;
  private readonly streamdb: RedisConnection;
  private readonly ctx: T & { emit: EmitFunction };
  private readonly concurrency: number;
  private readonly processorOptions: TaskManagerOptions<T>['processor'];

  private handlers: Map<string, TaskHandler<T, any>> = new Map();
  private handlerDebounce: Map<string, DebounceManager> = new Map(); // handlerKey -> DebounceManager
  private processor?: Processor;
  private queueStreams: Set<string> = new Set();
  private isStarted = false;
  private readonly expose?: number;
  private wsServer?: ReturnType<typeof createWsGateway>;
  readonly #jobFinishedListeners = new Set<
    (
      payload: {
        jobId: string;
        queue: string;
        status: 'completed' | 'failed';
        error?: string;
      },
    ) => void
  >();
  #jobFinishedUnsubscribe?: () => void;
  private readonly jobIdToSockets = new Map<string, Set<WebSocket>>();
  private readonly socketToJobIds = new Map<WebSocket, Set<string>>();

  // Job status messages (like old worker line 71-80)
  private readonly JOB_STATUS_MESSAGES = {
    processing: 'Job execution started',
    completed: 'Job completed successfully',
    delayed: (date: string) => `Job delayed until ${date}`,
    waiting: 'Job queued and waiting to be processed',
    failed: (error: string) => `Job failed: ${error}`,
  };

  private constructor(options: TaskManagerOptions<T>) {
    this.db = options.db;
    this.streamdb = options.streamdb || options.db;
    this.concurrency = options.concurrency ?? 1;
    this.processorOptions = options.processor || {};

    this.ctx = {
      ...(options.ctx || {} as T),
      emit: this.emit.bind(this),
    } as T & { emit: EmitFunction };
    this.expose = options.expose;
  }

  static init<T = unknown>(options: TaskManagerOptions<T>): TaskManager<T> {
    if (!TaskManager.instance) {
      TaskManager.instance = new TaskManager(options);
    }
    return TaskManager.instance as TaskManager<T>;
  }

  static getInstance<T = unknown>(): TaskManager<T> {
    return TaskManager.instance as TaskManager<T>;
  }

  /**
   * Register a handler for an event/task
   */
  async registerHandler<D = unknown>(
    options: {
      handler: TaskHandler<T, D>;
      event: string;
      queue?: string;
      options?: {
        repeat?: {
          pattern: string;
        };
        attempts?: number;
        debounce?: number;
      };
    },
  ): Promise<void> {
    const { handler, event, queue = 'default', options: jobOptions } = options;
    const debounce = jobOptions?.debounce;

    if (!event) {
      throw new Error('event is required');
    }

    if (!handler) {
      throw new Error('handler is required');
    }

    const handlerKey = `${queue}:${event}`;
    this.handlers.set(handlerKey, handler as TaskHandler<T, any>);

    const streamKey = `${queue}-stream`;
    this.queueStreams.add(streamKey);

    // Store debounce manager per handler (if provided in options.debounce)
    if (debounce !== undefined) {
      const debounceSeconds = Math.ceil(debounce / 1000); // Convert ms to seconds
      const debounceManager = new DebounceManager(debounceSeconds, undefined);
      this.handlerDebounce.set(handlerKey, debounceManager);
    }

    // If repeat pattern is provided, emit initial job for cron (like old queue-manager line 165-167)
    // The old system just calls emit - it doesn't check for existing cron
    // Cron jobs use the same ID generation as regular jobs (genJobId based on name and data)
    // We need to store the Redis key when emitting to match old behavior
    if (jobOptions?.repeat?.pattern) {
      // Don't use hash - use same ID format as regular jobs for consistency
      // The old system uses genJobId which creates: ${name}:${hashOfData}
      // For cron jobs with empty data, this will be deterministic
      this.emit({
        event,
        queue,
        data: {},
        options: {
          ...jobOptions,
        },
      });
    }
  }

  /**
   * Emit/trigger a task/event. Returns the job id so callers can track completion.
   */
  emit(args: {
    event: string;
    queue?: string;
    data?: unknown;
    options?: {
      id?: string;
      priority?: number;
      delayUntil?: Date;
      retryCount?: number;
      retryDelayMs?: number;
      repeat?: {
        pattern: string;
      };
      attempts?: number;
      [key: string]: unknown;
    };
  }): string {
    const {
      event,
      queue = 'default',
      data = {},
      options = {},
    } = args;

    if (!event) {
      throw new Error('event is required');
    }

    // Use same ID generation as old worker (genJobId based on name and data)
    // Don't special-case cron jobs - let genJobId handle it
    const jobId = options.id || genJobIdSync(event, data);

    let delayUntil = options.delayUntil || new Date();
    if (options.repeat?.pattern) {
      delayUntil = parseCronExpression(options.repeat.pattern).getNextDate(
        new Date(),
      );
    }

    const jobData = {
      id: jobId,
      state: {
        name: event,
        queue,
        data,
        options,
      },
      status: options.repeat?.pattern ? 'delayed' : 'waiting',
      delayUntil: delayUntil.getTime(),
      lockUntil: Date.now(),
      priority: options.priority ?? 0,
      retryCount: options.retryCount ?? (options.attempts ?? 0),
      retryDelayMs: options.retryDelayMs ?? 1000,
      retriedAttempts: 0,
      repeatCount: options.repeat?.pattern ? 1 : 0,
      repeatDelayMs: 0,
      logs: [{
        message: 'Added to the queue',
        timestamp: Date.now(),
      }],
      errors: [],
      timestamp: Date.now(),
    };

    const streamKey = `${queue}-stream`;

    this.streamdb.xadd(
      streamKey,
      '*',
      'data',
      JSON.stringify(jobData),
    ).catch((err: unknown) => {
      console.error(`Error emitting job to queue ${queue}:`, err);
    });

    const stateKey = `queues:${queue}:${jobId}:${jobData.status}`;
    this.db.set(stateKey, JSON.stringify(jobData)).catch((err: unknown) => {
      console.error(`Error storing job state:`, err);
    });
    return jobId;
  }

  /**
   * Subscribe to job completion/failure (e.g. for WebSocket reply).
   * Returns an unsubscribe function.
   */
  onJobFinished(
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
        console.error('jobFinished listener error:', err);
      }
    }
  }

  /**
   * Send a progressive update to WebSocket client(s) tracking this task (no-op if none).
   */
  private sendTaskUpdate({
    id,
    event,
    queue,
    data,
    progress,
  }: {
    id: string;
    event: string;
    queue: string;
    data: unknown;
    progress: number;
  }): void {
    const sockets = this.jobIdToSockets.get(id);
    if (!sockets?.size) return;
    const payloadStr = JSON.stringify({
      type: 'task_update',
      id,
      event,
      queue,
      data,
      progress,
    });
    for (const socket of sockets) {
      try {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(payloadStr);
        }
      } catch (err) {
        console.error('WS send task_update error:', err);
      }
    }
  }

  /**
   * Start processing jobs
   */
  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }

    // Ensure consumer groups exist for all registered streams
    for (const streamKey of this.queueStreams) {
      await this.ensureConsumerGroup(streamKey);
    }

    // Stop existing processor if it exists (to recreate with all current streams)
    if (this.processor) {
      this.processor.stop();
      await this.processor.waitForActiveTasks();
    }

    // Always recreate processor to include all currently registered handlers/queues
    // This ensures all registered streams are included (like old defaultWorker)
    this.createUnifiedProcessor();

    if (this.processor) {
      this.processor.start().catch((err) => {
        console.error('Error starting processor:', err);
      });
    }

    this.isStarted = true;
    this.setupGracefulShutdown();

    if (this.expose != null) {
      this.wsServer = createWsGateway({
        port: this.expose,
        hostname: '0.0.0.0',
        taskManager: this,
        onConnection: (ws) => this.handleWsConnection(ws),
      });
      this.#jobFinishedUnsubscribe = this.onJobFinished((payload) => {
        const sockets = this.jobIdToSockets.get(payload.jobId);
        if (!sockets) return;
        const payloadStr = JSON.stringify({
          type: 'task_finished',
          taskId: payload.jobId,
          queue: payload.queue,
          status: payload.status,
          error: payload.error,
        });
        for (const socket of sockets) {
          try {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(payloadStr);
            }
          } catch (err) {
            console.error('WS send task_finished error:', err);
          }
        }
        this.jobIdToSockets.delete(payload.jobId);
        for (const socket of sockets) {
          this.socketToJobIds.get(socket)?.delete(payload.jobId);
        }
      });
      console.log(`TaskManager WS gateway listening on 0.0.0.0:${this.expose}`);
    }

    const streamList = Array.from(this.queueStreams).join(', ');
    console.log(
      `TaskManager started with ${this.queueStreams.size} queue(s) [${streamList}] and concurrency ${this.concurrency}`,
    );
  }

  /**
   * Handle WebSocket client: accept { type: 'emit', event, queue?, data?, options? }, call emit,
   * reply with { type: 'queued', taskId } and later { type: 'task_finished', taskId, status, ... }.
   */
  private handleWsConnection(ws: WebSocket): void {
    const addJobForSocket = (jobId: string) => {
      if (!this.socketToJobIds.has(ws)) this.socketToJobIds.set(ws, new Set());
      this.socketToJobIds.get(ws)!.add(jobId);
      if (!this.jobIdToSockets.has(jobId)) {
        this.jobIdToSockets.set(jobId, new Set());
      }
      this.jobIdToSockets.get(jobId)!.add(ws);
    };
    const removeSocket = () => {
      const jobIds = this.socketToJobIds.get(ws);
      if (jobIds) {
        for (const jobId of jobIds) {
          this.jobIdToSockets.get(jobId)?.delete(ws);
          if (this.jobIdToSockets.get(jobId)?.size === 0) {
            this.jobIdToSockets.delete(jobId);
          }
        }
        this.socketToJobIds.delete(ws);
      }
    };

    ws.addEventListener('close', removeSocket);
    ws.addEventListener('message', (event) => {
      try {
        const raw = typeof event.data === 'string'
          ? event.data
          : new TextDecoder().decode(event.data as ArrayBuffer);
        const msg = JSON.parse(raw) as {
          type?: string;
          event?: string;
          queue?: string;
          data?: unknown;
          options?: Record<string, unknown>;
        };
        // Accept both { type: 'emit', event, ... } and { event, data, options }
        if (typeof msg?.event === 'string') {
          const jobId = this.emit({
            event: msg.event,
            queue: msg.queue,
            data: msg.data,
            options: msg.options,
          });
          addJobForSocket(jobId);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'queued', taskId: jobId }));
          }
        }
      } catch (_) {
        // ignore parse errors
      }
    });
  }

  /**
   * Stop processing jobs
   */
  async stop(): Promise<void> {
    this.#jobFinishedUnsubscribe?.();
    this.#jobFinishedUnsubscribe = undefined;
    this.jobIdToSockets.clear();
    this.socketToJobIds.clear();
    if (this.wsServer) {
      await this.wsServer.shutdown();
      this.wsServer = undefined;
    }
    if (this.processor) {
      this.processor.stop();
      await this.processor.waitForActiveTasks();
    }
    this.isStarted = false;
  }

  /**
   * Pause a queue (stops processing new jobs from this queue)
   */
  async pauseQueue(queue: string): Promise<void> {
    const pausedKey = `queues:${queue}:paused`;
    await this.db.set(pausedKey, 'true');
  }

  /**
   * Resume a queue (resumes processing jobs from this queue)
   */
  async resumeQueue(queue: string): Promise<void> {
    const pausedKey = `queues:${queue}:paused`;
    await this.db.del(pausedKey);
  }

  /**
   * Check if a queue is paused
   */
  async isQueuePaused(queue: string): Promise<boolean> {
    const pausedKey = `queues:${queue}:paused`;
    const isPaused = await this.db.get(pausedKey);
    return isPaused === 'true';
  }

  /**
   * Creates unified processor for all queues (like old defaultWorker)
   */
  private createUnifiedProcessor(): void {
    const allStreamKeys = Array.from(this.queueStreams);

    const unifiedMessageHandler = async (
      message: Message,
      ctx: MessageContext,
    ): Promise<void> => {
      const processableMessage = message as unknown as ProcessableMessage;
      const jobData = processableMessage.data;

      if (!jobData?.state?.name || !jobData?.state?.queue) {
        throw new Error('Invalid job data: missing state.name or state.queue');
      }

      const state = jobData.state;
      const stateAny = state as any;

      const queueName = state.queue || 'default';
      const jobName = state.name!;
      const handlerKey = `${queueName}:${jobName}`;
      const jobId = jobData.id || processableMessage.id;

      // Check if queue is paused (like old worker line 250-265)
      const pausedKey = `queues:${queueName}:paused`;
      const isPaused = await this.db.get(pausedKey);
      if (isPaused === 'true') {
        // Queue is paused - skip processing (don't ACK, let it be reclaimed)
        return;
      }

      // Check if individual job is paused (like old worker line 305-309)
      // Get current job data to check paused flag
      const jobStatusKey = `queues:${queueName}:${jobId}:${
        jobData.status || 'waiting'
      }`;
      const jobStatusData = await this.db.get(jobStatusKey);
      if (jobStatusData) {
        try {
          const parsedJob = JSON.parse(jobStatusData) as any;
          if (parsedJob.paused === true) {
            // Job is paused - skip processing (don't ACK, let it be reclaimed)
            return;
          }
        } catch {
          // If we can't parse, continue processing
        }
      }

      const handler = this.handlers.get(handlerKey);

      if (!handler) {
        const registeredHandlers = Array.from(this.handlers.keys()).join(', ');
        throw new Error(
          `No handler found for queue: ${queueName}, event: ${jobName}. Registered handlers: ${registeredHandlers}`,
        );
      }

      // Check handler-specific debounce (if configured in options.debounce)
      const debounceManager = this.handlerDebounce.get(handlerKey);
      if (debounceManager) {
        if (
          !debounceManager.shouldProcess(
            processableMessage as {
              id: string;
              data?: unknown;
              [key: string]: unknown;
            },
          )
        ) {
          await ctx.ack();
          return; // Skip - debounced
        }
        // Mark as processed after handler completes
        const originalHandler = handler;
        const wrappedHandler = async (task: any, ctx: any) => {
          await originalHandler(task, ctx);
          debounceManager.markProcessed(
            processableMessage as {
              id: string;
              data?: unknown;
              [key: string]: unknown;
            },
          );
        };
        await this.processJob(
          jobData,
          jobId,
          queueName,
          state,
          stateAny,
          wrappedHandler,
          processableMessage,
        );
      } else {
        // Process job (copied from old worker #processJob line 355-586)
        await this.processJob(
          jobData,
          jobId,
          queueName,
          state,
          stateAny,
          handler,
          processableMessage,
        );
      }
    };

    this.processor = new Processor({
      consumer: {
        streams: allStreamKeys,
        streamdb: this.streamdb,
        handler: unifiedMessageHandler,
        concurrency: this.concurrency,
        group: 'processor',
      },
      streamdb: this.streamdb,
      ...this.processorOptions,
    });
  }

  /**
   * Process a task (copied from old worker #processJob - robust logic)
   */
  private async processJob(
    jobEntry: any, // JobData from message
    jobId: string,
    queueName: string,
    state: any,
    stateAny: any,
    handler: TaskHandler<T, any>,
    processableMessage: ProcessableMessage,
  ): Promise<void> {
    try {
      // Step 1: Delete old status key FIRST (like old worker line 357)
      await this.db.del(`queues:${queueName}:${jobId}:${jobEntry.status}`);

      // Ensure job has logs array (like old worker line 360-362)
      if (!jobEntry.logs) {
        jobEntry.logs = [];
      }

      // Add logger function (like old worker line 365-383)
      if (!jobEntry.logger) {
        jobEntry.logger = async (message: string | object) => {
          const logEntry = {
            message: typeof message === 'string'
              ? message
              : JSON.stringify(message),
            timestamp: Date.now(),
          };

          jobEntry.logs?.push(logEntry);

          await this.db.set(
            `queues:${queueName}:${jobId}:logs:${crypto.randomUUID()}`,
            JSON.stringify(logEntry),
          );
        };
      }

      // Add processing status to logs (like old worker line 385-397)
      if (
        jobEntry.status !== 'processing' &&
        !jobEntry.logs.find((log: any) =>
          log.message === this.JOB_STATUS_MESSAGES.processing
        )
      ) {
        jobEntry.logs.push({
          message: this.JOB_STATUS_MESSAGES.processing,
          timestamp: Date.now(),
        });
      }

      // Update status to processing (like old worker line 399-409)
      const processingData = {
        ...jobEntry,
        lastRun: Date.now(),
        status: 'processing',
      };

      const processingKey =
        `queues:${queueName}:${processingData.id}:${processingData.status}`;
      await this.db.set(processingKey, JSON.stringify(processingData));

      // Process the job (like old worker line 412); inject per-task update for real-time WS updates
      const ctxWithUpdate = {
        ...this.ctx,
        update: (data: unknown, progress: number) =>
          this.sendTaskUpdate({
            id: jobId,
            event: state.name!,
            queue: state.queue!,
            data,
            progress,
          }),
      } as T & { emit: EmitFunction; update: UpdateFunction };
      await handler({
        name: state.name!,
        queue: state.queue!,
        data: state.data,
        options: stateAny?.options,
        logger: jobEntry.logger,
        ...processingData,
      } as any, ctxWithUpdate);

      // After processing, get any logs (like old worker line 414-419)
      const currentJobData = await this.db.get(processingKey);
      const currentJob = currentJobData
        ? JSON.parse(currentJobData)
        : processingData;

      // Combine logs and update status to completed (like old worker line 421-429)
      const completedData = {
        ...currentJob,
        logs: [...(currentJob.logs || []), {
          message: this.JOB_STATUS_MESSAGES.completed,
          timestamp: Date.now(),
        }],
        status: 'completed',
      };

      // Store completed state (like old worker line 431-438)
      await this.db.del(
        `queues:${queueName}:${completedData.id}:${completedData.status}`,
      ).catch(() => {});
      await this.db.del(processingKey);
      const completedKey = `queues:${queueName}:${completedData.id}:completed`;
      await this.db.set(completedKey, JSON.stringify(completedData));
      this.#notifyJobFinished({
        jobId,
        queue: queueName,
        status: 'completed',
      });

      // Handle job repetition (like old worker line 451-479)
      // IMPORTANT: Use jobEntry.id (original ID) not completedData.id to preserve cron ID
      if (
        jobEntry.repeatCount > 0 && jobEntry?.state?.options?.repeat?.pattern
      ) {
        const cron = parseCronExpression(jobEntry.state.options.repeat.pattern);

        const newJob = {
          ...jobEntry, // Use original jobEntry to preserve ID (like old worker line 459)
          lockUntil: cron.getNextDate(new Date()).getTime(),
          delayUntil: cron.getNextDate(new Date()).getTime(),
          repeatCount: jobEntry.repeatCount, // Keep same for infinite cron (like old worker line 466)
          timestamp: Date.now(),
          status: 'delayed',
          lastRun: Date.now(),
        };

        // Re-emit to stream (like old worker line 473-478 - just xadd, no Redis key storage)
        await this.streamdb.xadd(
          `${queueName}-stream`,
          '*',
          'data',
          JSON.stringify(newJob),
        );
      }
    } catch (error: unknown) {
      // Handle failed state (like old worker line 493-585)
      const errorMessage = error instanceof Error
        ? error.message
        : String(error);
      const isConfigError = errorMessage.includes('No handler found') ||
        errorMessage.includes('No handlers registered') ||
        errorMessage.includes('is undefined');

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

      const failedKey = `queues:${queueName}:${jobEntry.id}:failed`;
      await this.db.set(failedKey, JSON.stringify(failedData));
      this.#notifyJobFinished({
        jobId: jobEntry.id,
        queue: queueName,
        status: 'failed',
        error: errorMessage,
      });

      // Handle retry (like old worker line 527-551)
      if (jobEntry.retryCount > 0 && !isConfigError) {
        const retryJob = {
          ...jobEntry,
          delayUntil: Date.now() + (jobEntry.retryDelayMs || 1000),
          lockUntil: Date.now(),
          retryCount: jobEntry.retryCount - 1,
          retriedAttempts: (jobEntry.retriedAttempts || 0) + 1,
          logs: [...(jobEntry.logs || []), {
            message: `retrying ${jobEntry.retryCount} more times`,
            timestamp: Date.now(),
          }],
        };

        await this.streamdb.xadd(
          `${queueName}-stream`,
          '*',
          'data',
          JSON.stringify(retryJob),
        );
      }

      throw error; // Re-throw so Processor can handle
    }
  }

  /**
   * Setup graceful shutdown handlers
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      console.log(`Received ${signal}, shutting down gracefully...`);
      await this.stop();
      console.log('Shutdown complete');

      if (typeof Deno !== 'undefined') {
        // @ts-ignore
        Deno.exit(0);
      } else {
        // @ts-ignore
        if (typeof process !== 'undefined') {
          // @ts-ignore
          process.exit(0);
        }
      }
    };

    // @ts-ignore
    if (typeof Deno !== 'undefined') {
      // @ts-ignore
      Deno.addSignalListener('SIGINT', () => shutdown('SIGINT'));
      // @ts-ignore
      Deno.addSignalListener('SIGTERM', () => shutdown('SIGTERM'));
    } else {
      // @ts-ignore
      if (typeof process !== 'undefined') {
        // @ts-ignore
        process.on('SIGINT', () => shutdown('SIGINT'));
        // @ts-ignore
        process.on('SIGTERM', () => shutdown('SIGTERM'));
      }
    }
  }

  /**
   * Ensures consumer group exists
   */
  private async ensureConsumerGroup(streamKey: string): Promise<void> {
    try {
      await this.streamdb.xgroup(
        'CREATE',
        streamKey,
        'processor',
        '0',
        'MKSTREAM',
      );
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (err?.message?.includes('BUSYGROUP')) {
        return;
      }
      throw error;
    }
  }
}
