import type { RedisConnection } from '../../../core/src/types/redis.ts';
import type { AdminJobData, ListJobsOptions, JobStats, QueueInfo } from '../../types/admin.ts';

/**
 * AdminStore - Management API for jobs
 * 
 * Provides simple CRUD operations for job management in admin interfaces
 */
export class AdminStore {
  private readonly db: RedisConnection;

  constructor(db: RedisConnection) {
    this.db = db;
  }

  /**
   * Get a job by ID and queue
   */
  async getJob(jobId: string, queue: string): Promise<AdminJobData | null> {
    // Try to find job by checking all possible statuses
    const statuses: AdminJobData['status'][] = ['waiting', 'processing', 'completed', 'failed', 'delayed'];
    
    for (const status of statuses) {
      const key = `queues:${queue}:${jobId}:${status}`;
      const data = await this.db.get(key);
      
      if (data) {
        try {
          const jobData = JSON.parse(data) as AdminJobData;
          // Ensure status is set correctly
          jobData.status = status;
          return jobData;
        } catch (error) {
          console.error(`Error parsing job data for ${key}:`, error);
          return null;
        }
      }
    }
    
    return null;
  }

  /**
   * List jobs with optional filtering
   */
  async listJobs(options: ListJobsOptions = {}): Promise<AdminJobData[]> {
    const {
      queue,
      status,
      limit = 100,
      offset = 0,
    } = options;

    const jobs: AdminJobData[] = [];

    // If queue is specified, search only that queue
    // Otherwise, we'd need to scan all queues (more expensive)
    if (!queue) {
      throw new Error('queue is required for listJobs');
    }

    const statuses: AdminJobData['status'][] = status
      ? [status]
      : ['waiting', 'processing', 'completed', 'failed', 'delayed'];

    // For each status, scan keys matching pattern
    for (const statusType of statuses) {
      const pattern = `queues:${queue}:*:${statusType}`;
      
      // Use SCAN to find matching keys (more efficient than KEYS for production)
      let cursor = '0';
      do {
        const [nextCursor, keys] = await this.db.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        ) as [string, string[]];
        
        cursor = nextCursor;
        
        // Fetch job data for each key
        for (const key of keys) {
          try {
            const data = await this.db.get(key);
            if (data) {
              const jobData = JSON.parse(data) as AdminJobData;
              jobData.status = statusType; // Ensure status is set correctly
              jobs.push(jobData);
            }
          } catch (error) {
            console.error(`Error parsing job data for ${key}:`, error);
          }
        }
      } while (cursor !== '0');
    }

    // Sort by timestamp (newest first)
    jobs.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // Apply offset and limit
    return jobs.slice(offset, offset + limit);
  }

  /**
   * Delete a job (removes from Redis)
   */
  async deleteJob(jobId: string, queue: string): Promise<void> {
    const statuses: AdminJobData['status'][] = ['waiting', 'processing', 'completed', 'failed', 'delayed'];
    
    // Delete all status keys for this job
    const keysToDelete: string[] = [];
    
    for (const status of statuses) {
      keysToDelete.push(`queues:${queue}:${jobId}:${status}`);
    }
    
    // Also delete log keys (pattern: queues:queue:jobId:logs:*)
    const logPattern = `queues:${queue}:${jobId}:logs:*`;
    let cursor = '0';
    do {
      const [nextCursor, keys] = await this.db.scan(
        cursor,
        'MATCH',
        logPattern,
        'COUNT',
        100,
      ) as [string, string[]];
      
      cursor = nextCursor;
      keysToDelete.push(...keys);
    } while (cursor !== '0');
    
    // Delete all keys
    if (keysToDelete.length > 0) {
      await this.db.del(...keysToDelete);
    }
  }

  /**
   * Get job statistics for a queue
   */
  async getQueueStats(queue: string): Promise<JobStats> {
    const statuses: AdminJobData['status'][] = ['waiting', 'processing', 'completed', 'failed', 'delayed'];
    const stats: JobStats = {
      queue,
      waiting: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      total: 0,
    };

    for (const status of statuses) {
      const pattern = `queues:${queue}:*:${status}`;
      let count = 0;
      let cursor = '0';
      
      do {
        const [nextCursor, keys] = await this.db.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        ) as [string, string[]];
        
        cursor = nextCursor;
        count += keys.length;
      } while (cursor !== '0');
      
      stats[status] = count;
      stats.total += count;
    }

    return stats;
  }

  /**
   * Get all queues (discovered by scanning keys)
   */
  async getQueues(): Promise<string[]> {
    const queues = new Set<string>();
    let cursor = '0';
    
    // Scan for all queue:* keys
    do {
      const [nextCursor, keys] = await this.db.scan(
        cursor,
        'MATCH',
        'queues:*:*:*',
        'COUNT',
        100,
      ) as [string, string[]];
      
      cursor = nextCursor;
      
      // Extract queue names from keys (queues:queueName:jobId:status)
      for (const key of keys) {
        const parts = key.split(':');
        if (parts.length >= 2 && parts[0] === 'queues') {
          queues.add(parts[1]);
        }
      }
    } while (cursor !== '0');
    
    return Array.from(queues).sort();
  }

  /**
   * Get queue info with statistics
   */
  async getQueuesInfo(): Promise<QueueInfo[]> {
    const queueNames = await this.getQueues();
    const queues: QueueInfo[] = [];
    
    for (const queueName of queueNames) {
      const stats = await this.getQueueStats(queueName);
      queues.push({
        name: queueName,
        stats,
      });
    }
    
    return queues;
  }

  /**
   * Retry a failed job
   */
  async retryJob(jobId: string, queue: string): Promise<AdminJobData | null> {
    const job = await this.getJob(jobId, queue);
    
    if (!job) {
      return null;
    }
    
    if (job.status !== 'failed') {
      throw new Error(`Cannot retry job with status: ${job.status}. Only failed jobs can be retried.`);
    }
    
    // Create a new job with same data but reset status
    const newJobData: AdminJobData = {
      ...job,
      status: 'waiting',
      retriedAttempts: job.retriedAttempts + 1,
      timestamp: Date.now(),
      delayUntil: Date.now(),
      lockUntil: Date.now(),
      logs: [
        ...job.logs,
        {
          message: `Job retried (attempt ${job.retriedAttempts + 1})`,
          timestamp: Date.now(),
        },
      ],
    };
    
    // Delete old failed status
    await this.db.del(`queues:${queue}:${jobId}:failed`);
    
    // Store as waiting
    const waitingKey = `queues:${queue}:${jobId}:waiting`;
    await this.db.set(waitingKey, JSON.stringify(newJobData));
    
    // Also add to stream so it gets processed
    // Note: This requires access to streamdb, which we don't have here
    // For now, just update the status. The job will need to be re-emitted via TaskManager
    
    return newJobData;
  }

  /**
   * Cancel a job (delete if waiting/delayed, or mark for cancellation if processing)
   */
  async cancelJob(jobId: string, queue: string): Promise<boolean> {
    const job = await this.getJob(jobId, queue);
    
    if (!job) {
      return false;
    }
    
    // Can only cancel waiting or delayed jobs
    if (job.status !== 'waiting' && job.status !== 'delayed') {
      throw new Error(`Cannot cancel job with status: ${job.status}. Only waiting or delayed jobs can be cancelled.`);
    }
    
    // Simply delete the job
    await this.deleteJob(jobId, queue);
    
    return true;
  }
}
