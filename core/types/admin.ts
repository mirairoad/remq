/**
 * Job data structure for admin API
 */
export interface AdminJobData {
  id: string;
  state: {
    name: string;
    queue: string;
    data?: unknown;
    options?: {
      repeat?: {
        pattern: string;
      };
      [key: string]: unknown;
    };
  };
  status: 'waiting' | 'processing' | 'completed' | 'failed' | 'delayed';
  delayUntil: number;
  lockUntil: number;
  priority: number;
  retryCount: number;
  retryDelayMs: number;
  retriedAttempts: number;
  repeatCount: number;
  repeatDelayMs: number;
  logs: Array<{
    message: string;
    timestamp: number;
  }>;
  errors: string[];
  timestamp: number;
  lastRun?: number;
  paused?: boolean;
}

/**
 * Options for listing jobs
 */
export interface ListJobsOptions {
  queue?: string;
  status?: 'waiting' | 'processing' | 'completed' | 'failed' | 'delayed';
  limit?: number;
  offset?: number;
}

/**
 * Task statistics per queue
 */
export interface TaskStats {
  queue: string;
  waiting: number;
  processing: number;
  completed: number;
  failed: number;
  delayed: number;
  total: number;
}

/**
 * Queue information
 */
export interface QueueInfo {
  name: string;
  stats: TaskStats;
}
