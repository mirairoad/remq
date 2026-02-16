import type { RedisConnection } from './index.ts';
import type { ProcessorOptions } from './processor.ts';

/**
 * Update function – send a progressive update to the client over WebSocket (when task was triggered via WS).
 */
export interface UpdateFunction {
  (
    data: unknown,
    progress?: number,
  ): void;
}

/**
 * Handler function signature
 */
export interface TaskHandler<T = unknown, D = unknown> {
  (
    task: {
      name: string;
      queue: string;
      data?: D;
      logger?: (message: string | object) => Promise<void>;
    },
    ctx: T & { emit: EmitFunction; update: UpdateFunction },
  ): Promise<void> | void;
}

/**
 * Emit function for triggering new tasks
 */
export interface EmitFunction {
  (args: {
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
      debounce?: number;
    };
  }): string;
}

/**
 * Task Manager options
 */
export interface TaskManagerOptions<T = unknown> {
  /**
   * Redis connection for task storage
   */
  db: RedisConnection;

  /**
   * Expose port for the task manager
   * @default 4000
   */
  expose?: number;

  /**
   * Context object passed to handlers
   */
  ctx?: T;

  /**
   * Number of concurrent tasks to process
   * @default 1
   */
  concurrency?: number;

  /**
   * Optional separate Redis connection for streams (for performance)
   * If not provided, uses db connection
   */
  streamdb?: RedisConnection;

  /**
   * Processor options (retry, DLQ, debounce)
   */
  processor?: {
    retry?: ProcessorOptions['retry'];
    dlq?: ProcessorOptions['dlq'];
    debounce?: ProcessorOptions['debounce'];
    ignoreConfigErrors?: boolean;
  };
}

/**
 * Handler registration options
 */
export interface RegisterHandlerOptions<T = unknown, D = unknown> {
  /**
   * Handler function
   */
  handler: TaskHandler<T, D>;

  /**
   * Event/Task name
   */
  event: string;

  /**
   * Queue name (defaults to 'default')
   */
  queue?: string;

  /**
   * Task options (for cron/repeatable tasks)
   */
  options?: {
    repeat?: {
      pattern: string;
    };
    attempts?: number;
    debounce?: number; // Debounce window in milliseconds
    [key: string]: unknown;
  };
}
