import type { RedisConnection } from './index.ts';
import type { ProcessorOptions } from './processor.ts';

/**
 * Handler function signature
 */
export interface TaskHandler<T = unknown, D = unknown> {
  (job: {
    name: string;
    queue: string;
    data?: D;
    logger?: (message: string | object) => Promise<void>;
  }, ctx: T & { emit: EmitFunction }): Promise<void> | void;
}

/**
 * Emit function for triggering new jobs
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
  }): void;
}

/**
 * Task Manager options
 */
export interface TaskManagerOptions<T = unknown> {
  /**
   * Redis connection for job storage
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
   * Number of concurrent jobs to process
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
   * Event/Job name
   */
  event: string;

  /**
   * Queue name (defaults to 'default')
   */
  queue?: string;

  /**
   * Job options (for cron/repeatable jobs)
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

