/**
 * Represents the state of a job
 * @template C - The type of data the job expects
 */
export interface JobState {
  name: string;
  queue: string;
  data?: unknown;
  options?: JobOptions;
}

/**
 * Represents the data of a job
 * @template C - The type of data the job expects
 */
export interface JobData {
  id: string;
  messageId: string;
  streamKey?: string;
  state: JobState;
  status: 'waiting' | 'processing' | 'completed' | 'failed' | 'delayed';
  priority: number;
  addedAt: number;
  delayUntil: number;
  lockUntil: number;
  lastRun?: number;
  retriedAttempts: number;
  repeatCount: number;
  repeatDelayMs: number;
  retryCount: number;
  retryDelayMs: number;
  paused: boolean;
  logger: (message: string | object) => Promise<void>;
  logs: {
    message: string;
    timestamp: number;
  }[];
  errors?: string[];
  timestamp: number;
}

/**
 * Represents the options for a job
 * @template C - The type of data the job expects
 */
export interface JobOptions {
  id?: string;
  priority?: number;
  delayUntil?: Date;
  lockUntil?: Date;
  retryCount?: number;
  retryDelayMs?: number;
  repeatCount?: number;
  repeatDelayMs?: number;
  retriedAttempts?: number;
  repeat?: {
    pattern: string;
  };
  attempts?: number;
  logs?: string[];
  errors?: string[];
}

/**
 * Represents a job to be pushed to the queue
 * @template C - The type of data the job expects
 */
export interface PushJob {
  name: string;
  queue: string;
  data?: unknown;
  options?: JobOptions;
}

/**
 * Represents the extended job data with generic type support
 * @template C - The type of data the job expects
 */
export interface ExtJobData<C> extends JobState {
  logger: (message: string | object) => Promise<void>;
  data?: C;
}

/**
 * Represents a job handler function
 * @template C - The type of data the job expects
 */
export interface JobHandler<C> {
  (job: ExtJobData<C>, ctx: unknown): Promise<void>;
}

/**
 * Represents the options for the job queue manager
 * @template C - The type of data the job expects
 */
export interface JobQueueManagerOptions {
  concurrency?: number;
}

/**
 * Represents a job definition with handler and configuration
 * @template C - The type of data the job expects
 * @template T - The type of context the job will receive
 */
export type JobType<C> = {
  name: string;
  queue: string;
  description?: string;
  handler: JobHandler<C>;
  options?: JobOptions;
};

/**
 * Represents the default context object that will be passed to the job handler
 * @template T - The type of context the job will receive
 */
export interface defaultContext {
  emit: ({name, queue, description, data, options}: {name: string, queue: string, description?: string, data: unknown, options?: JobOptions}) => void;
}

/**
 * Represents the context object that will be passed to the job handler
 * @template T - The type of context the job will receive
 */
export interface ExtHandler<T, C> {
  (job: T, ctx: C): Promise<void> | void;
}

/**
 * Represents a job definition with handler and configuration
 * @template C - The type of data the job expects
 * @template T - The type of context the job will receive
 *
 * @example
 * ```typescript
 * import type { Job } from '@core/types/index.ts';
 * import type { AppContext } from '../index.ts';
 *
 * // Define the data structure for your job
 * type DataStructure = {
 *   users: {
 *     name: string;
 *     email: string;
 *   }[]
 * }
 *
 * // Create a job definition
 * const job: Job<DataStructure, AppContext> = {
 *   name: 'start',
 *   queue: 'scheduler',
 *   handler: async (job, ctx) => {
 *     console.log('- runs every 30 seconds');
 *
 *     // Create child jobs with the context
 *     for (let i = 0; i < 10; i++) {
 *       ctx.emit('scheduler/onrequest', {
 *         name: 'onrequest',
 *         queue: 'scheduler',
 *         data: {},
 *         options: {
 *           id: `onrequest-${i}`
 *         }
 *       });
 *     }
 *
 *     // Use the job logger
 *     await job.logger('Job execution completed');
 *   },
 *   options: {
 *     repeat: {
 *       pattern: "* * * * *"
 *     },
 *     attempts: 3
 *   }
 * };
 *
 * export default job;
 * ```
 */
export interface Task<C,T = unknown> {
  name: string;
  queue: string;
  description?: string;
  handler: ExtHandler<ExtJobData<C>,T &defaultContext>;
  options?: JobOptions;
}

// update: (job: Partial<JobData>) => Promise<void>,
// helpers: { stopProcessing: () => void };
