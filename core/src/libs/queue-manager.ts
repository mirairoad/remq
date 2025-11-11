import type {
  ExtJobData,
  JobData,
  JobHandler,
  JobOptions,
  JobType,
  RedisConnection,
} from '../types/index.ts';
import { parseCronExpression } from 'cron-schedule';
import { Queue } from './queue.ts';
import type { Worker } from './worker.ts';

/**
 * QueueManager class for managing job queues
 */


interface QueueManagerInterface<T = unknown>
  extends Omit<QueueManager<T>, 'createConsumerGroup' | 'logger' | 'trimJobs'> {
}

export class QueueManager<T = unknown> implements QueueManagerInterface<T> {
  private static instance: QueueManager<any>;
  private queues: { [key: string]: { [key: string]: Queue } } = {};
  private workers: { [key: string]: Worker } = {};
  private handlers: {
    [key: string]: { [key: string]: JobHandler<any> };
  } = {};
  private db: RedisConnection;
  private ctx: T;
  private concurrency: number;
  private streamdb: RedisConnection;
  private maxJobsPerStatus: number;
  private constructor(
    db: RedisConnection,
    ctx: T,
    concurrency: number,
    streamdb?: RedisConnection,
    maxJobsPerStatus: number = 200,
  ) {
    this.db = db;
    this.ctx = { ...ctx, addJob: this.addJob.bind(this) } as T;
    this.concurrency = concurrency;
    this.streamdb = streamdb || db;
    this.maxJobsPerStatus = maxJobsPerStatus;
  }

  /**
   * Initializes the queue manager
   * @param db - Redis connection
   * @param ctx - Context object
   * @param concurrency - Number of concurrent jobs
   * @returns QueueManager instance
   */
  static init<T>(
   args: { 
    db: RedisConnection,
    ctx: T, 
    concurrency: number,
    options: { maxJobsPerStatus: number },
  }
  ): QueueManager<T> {
    if (!QueueManager.instance) {
      let streamdbIndex = args.db?.options?.db;
      let streamdb;
      // if (db?.options?.optimise) {
        streamdbIndex = args.db?.options?.db ? args.db?.options?.db + 1 : 1;
        if (streamdbIndex > 15) {
          throw new Error(`Redis database limit reached\n\n
              Optimise is enable means your "options.db + 1" is greater than 15
              \n\n
              Select a number between 0 and 14 when optimise is enable
              \n\n
              THIS IS A CUSTOM OPTIONS FOR REDIS CONNECTION
              \n\n
              const redisOption = {
                db: 0-15,
              } OR
              \n\n
              `);
        }
        streamdb = args.db?.duplicate({ db: streamdbIndex });
      // } else {
      //   streamdb = db;
      // }
      QueueManager.instance = new QueueManager(
        args.db,
        args.ctx,
        args.concurrency,
        streamdb,
        args.options.maxJobsPerStatus,
      );
    }
    return QueueManager.instance as QueueManager<T>;
  }

  /**
   * Creates a consumer group for a queue
   * @param queueName - Name of the queue to create a consumer group for
   * @throws Error if queue name is not provided
   */
  private async createConsumerGroup(queueName: string): Promise<void> {
    if (!queueName) {
      throw new Error('queueName is required');
    }
    try {
      await this.streamdb.xgroup(
        'CREATE',
        `${queueName}-stream`,
        'workers', // keep an eye on this as the consumer is always worker
        '$',
        'MKSTREAM',
      );
    } catch (err) {
      const error = err as { message: string };
      if (!error?.message?.includes('BUSYGROUP')) console.error(err);
    }
  }

  /**
   * Registers a job with the queue manager
   * @param job - Job configuration
   * @throws Error if job name or queue is invalid
   */
  registerJob<D = unknown, T = unknown>(
    job: {
      name: string;
      queue: string;
      handler: (job: ExtJobData<D>, ctx: T & { addJob: (args: {name: string, queue: string, data?: unknown , options?: JobType<D>['options'] }) => void }) => void;
      options?: JobOptions;
    },
  ): void {

   if(!job.name) {
    throw new Error(`name is required`);
   }
   if(!job.queue) {
    throw new Error(`queue is required`);
   }
    if(!job.handler) {
      throw new Error(`handler is required`);
    }
    const queueName = job.queue;
    const jobName = job.name;

    let queue: Queue;

    if (!this.queues[queueName]) {
      queue = new Queue(this.db, queueName, this.streamdb);
      this.queues[queueName] = { queue };
      this.createConsumerGroup(queueName);
    } else {
      queue = this.queues[queueName].queue;
    }

    for (const key in this.queues[queueName]) {
      if (job?.options?.repeat?.pattern) {
        this.addJob({name: jobName, queue: queueName, data: {}, options: job.options});
      }
      continue;
    }

    this.handlers[queueName] = {
      ...this.handlers[queueName],
      [jobName]: job.handler,
    } as unknown as { [key: string]: JobHandler<any> };

    const worker = queue.createWorker(async (jobData: JobData) => {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (!jobData.state.name || jobData.state.name === 'undefined') {
        throw new Error(`job.state.name is undefined`);
      }

      // Create logger instance
      const logger = await this.logger(jobData);

      // Pass job state with logger to handler
      return this.handlers[queueName][jobData.state.name]({
        ...jobData.state,
        logger,
      }, this.ctx);
    }, { concurrency: this.concurrency });

    this.workers[queueName] = worker;
  }


  /**
   * Adds a job to the queue
   * @param name - Name of the job
   * @param queue - Queue of the job
   * @param description - Description of the job
   * @param data - Data to pass to the job
   * @param options - Options for the job
   */
  addJob(
    args: {name: string, queue: string, data?: unknown , options?: JobType<any>['options'] },
  ): void {
    const optionsLayer = {
      delayUntil: new Date(),
      lockUntil: new Date(),
      retryCount: 0,
      repeatCount: 0,
    };

    const { name, queue: queueName, data = {}, options = {} } = args;

    if (!name || !queueName) {
      throw new Error('name and queueName are required');
    }
    const jobName = name;
    
    const queue = this.queues[queueName]?.queue;

    if (!queue) {
      (async () => {
        await this.deleteAllJobsUtil(queueName, 'all');
      })();
      throw new Error(`Queue ${queueName} not found`);
    }

    if (options?.repeat?.pattern) {
      optionsLayer.delayUntil = parseCronExpression(options?.repeat?.pattern)
        .getNextDate(new Date());
      optionsLayer.lockUntil = parseCronExpression(options?.repeat?.pattern)
        .getNextDate(new Date());
      optionsLayer.repeatCount = 1;
    }

    if (options?.attempts) {
      optionsLayer.retryCount = options?.attempts;
    }
    queue.pushJob({
      name: jobName,
      queue: queueName,
      data,
      ...(options ? { options } : {}),
    }, { ...optionsLayer });
  }

  /**
   * Processes all jobs in the queue
   */
  processJobs(): void {
    for (const worker of Object.values(this.workers)) {
      worker.processJobs();
    }

    // Trim jobs to keep the database size manageable
    this.trimJobs();
    
  }

  /**
   * Stops all workers and closes the connection
   */
  shutdown(): void {
    for (const worker of Object.values(this.workers)) {
      worker.stopProcessing();
    }
  }

  private async logger(
    job: JobData,
  ): Promise<(message: string | object) => Promise<void>> {
    // Get the job key
    const key = `queues:${
      job.id.replace(job.state.name, job.state.name + ':' + job.state.queue)
    }:${job.status}`;

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Return the actual logging function
    return async (message: string | object) => {
      // Get the latest job state for each log
      const currentJobState = await this.db.get(key);
      const jobStateObject = JSON.parse(currentJobState ?? '{"logs": []}');

      // Create log entry with timestamp
      const logEntry = {
        timestamp: Date.now(),
        message: typeof message === 'string'
          ? message
          : JSON.stringify(message),
      };

      const data = JSON.stringify(logEntry.message);
      // console.log(new Date().toISOString(), data)
      // Add to logs array
      jobStateObject.logs.push(data);
      // console.log(key, jobStateObject.logs)
      // Save updated state
      await this.db.set(key, JSON.stringify(jobStateObject));
    };
  }

  /**
   * Pauses a queue by name
   * @param queueName - Name of the queue to pause
   * @throws Error if queue not found
   */
  pauseQueue(queueName: string): void {
    try {
      if (!this.queues[queueName]) {
        throw new Error(`Queue ${queueName} not found`);
      }
      this.queues[queueName].queue.pause();
    } catch (error) {
      console.error('Error pausing queue:', error);
    }
  }

  /**
   * Resumes a queue by name
   * @param queueName - Name of the queue to resume
   * @throws Error if queue not found
   */
  resumeQueue(queueName: string): void {
    try {
      if (!this.queues[queueName]) {
        throw new Error(`Queue ${queueName} not found`);
      }
      this.queues[queueName].queue.resume();
    } catch (error) {
      console.error('Error resuming queue:', error);
    }
  }

  // Handle jobs Data

  /**
   * Gets jobs sorted by queue and status, with automatic trimming when needed
   * includes calculation of total, waiting, processing, failed, completed, delayed
   * ideal for the UI or API
   * @param maxJobsPerStatus Maximum number of jobs to display per status (default: 200)
   */
  async getSortedJobs(
    maxJobsPerStatus: number = this.maxJobsPerStatus,
  ): Promise<any[]> {
    try {
      const foundJobs = await this.getJobs();
      const jobs = foundJobs.filter((job: any) => job.state?.queue && job.state?.name);
      const pausedQueues = foundJobs
        .filter((statuses: any) => !statuses.state?.queue)
        .map((statuses: any) => statuses.id);

      // Transform jobs for UI consumption
      const uiJobs = jobs.map((job: any) => ({
        id: job.id.replace(
          /:waiting|:processing|:failed|:completed|:delayed/g,
          '',
        ),
        state: job.state,
        status: job.status,
        priority: job.priority,
        addedAt: job?.addedAt,
        delayUntil: job.delayUntil,
        lockUntil: job.lockUntil,
        lastRun: job?.lastRun,
        retriedAttempts: job?.retriedAttempts,
        repeatCount: job.repeatCount,
        repeatDelayMs: job.repeatDelayMs,
        retryCount: job.retryCount,
        retryDelayMs: job.retryDelayMs,
        timestamp: job.timestamp,
        logs: job.logs,
        errors: job.errors,
      }));

      // Group jobs by queue and status
      const dividedByQueuesAndStatus = uiJobs.reduce((acc: any, job: any) => {
        const queueName = job.state?.queue;
        if (!acc[queueName]) {
          acc[queueName] = {
            waiting: [],
            processing: [],
            failed: [],
            completed: [],
            delayed: [],
          };
        }

        // Push job to appropriate status array
        const status = job.status.toLowerCase();
        if (acc[queueName][status]) {
          acc[queueName][status].push(job);
        }

        return acc;
      }, {});

      // Track if we need to trim the database
      let needsTrimming = false;

      // Limit jobs per status for UI display and detect if trimming is needed
      for (const queue in dividedByQueuesAndStatus) {
        for (const status in dividedByQueuesAndStatus[queue]) {
          if (
            dividedByQueuesAndStatus[queue][status].length > maxJobsPerStatus
          ) {
            // If any category exceeds limit, we'll need to trim the database
            needsTrimming = true;

            // Sort by addedAt (newest first)
            dividedByQueuesAndStatus[queue][status].sort((a: any, b: any) =>
              (b.addedAt || b.timestamp) - (a.addedAt || a.timestamp)
            );

            // Keep only the most recent jobs for UI display
            dividedByQueuesAndStatus[queue][status] =
              dividedByQueuesAndStatus[queue][status].slice(
                0,
                maxJobsPerStatus,
              );
          }
        }
      }

      // If we detected job counts exceeding limits, trigger trimming
      if (needsTrimming) {
        // Don't await this so it doesn't slow down the UI response
        this.trimJobs(maxJobsPerStatus).catch((err) =>
          console.error('Error during background trimming:', err)
        );
      }

      // Format final response
      const queues = Object.keys(dividedByQueuesAndStatus).map((
        queue: any,
      ) => ({
        name: queue,
        paused: pausedQueues.includes(`queues:${queue}:paused`),
        stats: {
          total: dividedByQueuesAndStatus[queue].waiting.length +
            dividedByQueuesAndStatus[queue].processing.length +
            dividedByQueuesAndStatus[queue].failed.length +
            dividedByQueuesAndStatus[queue].completed.length +
            dividedByQueuesAndStatus[queue].delayed.length,
          waiting: dividedByQueuesAndStatus[queue].waiting.length,
          processing: dividedByQueuesAndStatus[queue].processing.length,
          failed: dividedByQueuesAndStatus[queue].failed.length,
          completed: dividedByQueuesAndStatus[queue].completed.length,
          delayed: dividedByQueuesAndStatus[queue].delayed.length,
        },
        jobs: dividedByQueuesAndStatus[queue], // Now contains limited status arrays
      }));

      return queues;
    } catch (error) {
      console.error('Error monitoring jobs:', error);
      return [];
    }
  }

  /**
   * Gets all active jobs from the database
   * @returns Array of active jobs
   */
  async getJobs(): Promise<any[]> {
    const activeJobs = [];
    let cursor = '0';
    do {
      // Get batch of keys using SCAN
      const [nextCursor, keys] = await this.db.scan(
        cursor,
        'MATCH',
        'queues:*',
        'COUNT',
        '1000',
      );
      cursor = nextCursor;
      if (keys.length > 0) {
        // Use Redis pipelining or MGET for batch retrieval
        // Option 1: If your Redis client supports pipelining
        if (typeof this.db.pipeline === 'function') {
          const pipeline = this.db.pipeline();
          keys.forEach((key) => pipeline.get(key));
          const results = await pipeline.exec() as [
            Error | null,
            string | null,
          ][];

          if (!results) continue;

          results.forEach((result, i) => {
            if (result && result[1]) {
              try {
                activeJobs.push({
                  ...JSON.parse(result[1]),
                  id: keys[i],
                });
              } catch (err) {
                console.error(
                  `Failed to parse job data for key ${keys[i]}:`,
                  err,
                );
              }
            }
          });
        } // Option 2: If your Redis client supports MGET
        else if (typeof this.db.mget === 'function') {
          const values = await this.db.mget(...keys);

          values.forEach((value, i) => {
            if (value) {
              try {
                activeJobs.push({
                  ...JSON.parse(value),
                  id: keys[i],
                });
              } catch (err) {
                console.error(
                  `Failed to parse job data for key ${keys[i]}:`,
                  err,
                );
              }
            }
          });
        } // Option 3: Fallback to original implementation
        else {
          for (const key of keys) {
            const job = await this.db.get(key);
            if (job) {
              try {
                activeJobs.push({
                  ...JSON.parse(job),
                  id: key,
                });
              } catch (err) {
                console.error(`Failed to parse job data for key ${key}:`, err);
              }
            }
          }
        }
      }
    } while (cursor !== '0');
    return activeJobs;
  }

  /**
   * Gets a specific job by its ID
   * @param id - Job ID to retrieve
   * @returns Job data or null if not found
   */
  async getJobById(id: string): Promise<any | null> {
    try {
      const foundJob = await this.db.get(`${id}`);
      return foundJob ? JSON.parse(foundJob) : null;
    } catch (error) {
      console.error('Error getting job by ID:', error);
      return null;
    }
  }

  /**
   * Toggles the paused state of a specific job
   * @param id - Job ID to toggle pause state
   * @returns 'OK' if paused, null if unpaused or error
   */
  async togglePauseJobById(id: string): Promise<string | null> {
    try {
      const foundJob = await this.db.get(`${id}`);
      if (!foundJob) return null;
      const jobData = JSON.parse(foundJob);
      if (!['waiting', 'delayed'].includes(jobData.status)) {
        throw new Error(`Job ${id} is not in waiting or delayed status`);
      }
      if (jobData.paused) {
        jobData.paused = false;
      } else {
        jobData.paused = true;
      }
      await this.db.set(`${id}`, JSON.stringify(jobData));
      return jobData.paused ? 'OK' : null;
    } catch (error) {
      console.error('Error toggling job pause state:', error);
      return null;
    }
  }

  /**
   * Deletes a job by its ID
   * @param id - Job ID to delete
   * @returns 'OK' if deleted, null otherwise
   */
  async deleteJobById(id: string): Promise<string | null> {
    const deletedJob = await this.db.del(`${id}`);
    try {
      if (deletedJob) {
        await this.db.del(`${id}-stream`);
      }
      return deletedJob ? 'OK' : null;
    } catch (error) {
      console.error('Error deleting job:', error);
      return null;
    }
  }

  /**
   * Deletes all jobs in a queue with a specific status
   * @param queueName - String in format "queueName" or "all" for all queues
   * @param status - Status of the job or "all" for all statuses
   * @returns 'OK' if deleted, null if error
   */
  async deleteAllJobsUtil(queueName: string, status: 'waiting' | 'processing' | 'failed' | 'completed' | 'delayed' | 'all'): Promise<string | null> {
    try {
      const foundJobs = await this.getJobs();
      const jobs = foundJobs.filter((job: any) => job.state?.queue && job.state?.name);
      // Handle delete all jobs across all queues and statuses
      if (queueName === 'all' && status === 'all') {
        await Promise.all(
          jobs.map((job: any) => this.deleteJobById(job.id))
        );
        return 'OK';
      }
      
      // Handle delete all jobs in a specific queue across all statuses
      if (queueName !== 'all' && status === 'all') {
        const queueJobs = jobs.filter((job: any) => job.state.queue === queueName);
        await Promise.all(
          queueJobs.map((job: any) => this.deleteJobById(job.id))
        );
        return 'OK';
      }
      
      // Handle delete all jobs with a specific status across all queues
      if (queueName === 'all' && status !== 'all') {
        const statusJobs = jobs.filter((job: any) => job.status === status);
        await Promise.all(
          statusJobs.map((job: any) => this.deleteJobById(job.id))
        );
        return 'OK';
      }
      
      // Handle delete all jobs in a specific queue with a specific status
      const filteredJobs = jobs.filter((job: any) => 
        job.state.queue === queueName && job.status === status
      );
      
      await Promise.all(
        filteredJobs.map((job: any) => this.deleteJobById(job.id))
      );
      
      return 'OK';
    } catch (err) {
      console.error('Error deleting all jobs:', err);
      return null;
    }
  }


  async deleteAllJobsByQueue(queueName: string): Promise<string | null> {
    await this.deleteAllJobsUtil(queueName, 'all');
    return 'OK';
  }

  async deleteAllJobsByStatus(status: 'waiting' | 'processing' | 'failed' | 'completed' | 'delayed' | 'all'): Promise<string | null> {
    await this.deleteAllJobsUtil('all', status);
    return 'OK';
  }

  async deleteAllJobs(): Promise<string | null> {
    await this.deleteAllJobsUtil('all', 'all');
    return 'OK';
  }

  /**
   * Trims the job lists to keep them at a manageable size
   * Keeps only the most recent jobs (default 200 per status)
   * @param maxJobsPerStatus The maximum number of jobs to keep per status category
   */
  private async trimJobs(
    maxJobsPerStatus: number = this.maxJobsPerStatus,
  ): Promise<void> {
    try {
      // Get all jobs
      const foundJobs = await this.getJobs();
      const jobs = foundJobs.filter((job: any) => job.state?.queue && job.state?.name);

      // Group by queue and status
      const jobsByQueueAndStatus = jobs.reduce((acc: any, job: any) => {
        const queueName = job.state?.queue;
        const status = job.status.toLowerCase();

        if (!acc[queueName]) {
          acc[queueName] = {
            waiting: [],
            processing: [],
            failed: [],
            completed: [],
            delayed: [],
          };
        }

        if (acc[queueName][status]) {
          acc[queueName][status].push(job);
        }

        return acc;
      }, {});

      // Process each queue and status
      for (const queueName of Object.keys(jobsByQueueAndStatus)) {
        for (const status of Object.keys(jobsByQueueAndStatus[queueName])) {
          const statusJobs = jobsByQueueAndStatus[queueName][status];

          // If we have more than the limit, trim the oldest ones
          if (statusJobs.length > maxJobsPerStatus) {
            // Sort by addedAt timestamp (most recent first)
            statusJobs.sort((a: any, b: any) =>
              (b.addedAt || b.timestamp) - (a.addedAt || a.timestamp)
            );

            // Keep only the newest maxJobsPerStatus jobs
            const jobsToDelete = statusJobs.slice(maxJobsPerStatus);

            // console.log(`Trimming ${jobsToDelete.length} ${status} jobs from queue ${queueName}`);

            // Delete the oldest jobs from the database
            for (const job of jobsToDelete) {
              try {
                await this.db.del(job.id);

                // Also clean up any associated stream entries
                if (job.messageId) {
                  await this.streamdb.xdel(
                    `${queueName}-stream`,
                    job.messageId,
                  );
                }
              } catch (error) {
                console.error(`Error deleting job ${job.id}:`, error);
              }
            }
          }
        }
      }

      // console.log('Job trimming completed');
    } catch (error) {
      // console.error('Error trimming jobs:', error);
    }
  }

  getQueuesList(): string[] {
    return Object.keys(this.queues);
  }

  getJobsList(): string[] {
    const jobs = (Object.entries(this.handlers).map(([key, value]) => Object.keys(value))).flat();
    return jobs;
  }
}
