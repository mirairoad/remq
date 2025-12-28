import { TaskManager } from '@core_v2/mod.ts';
import { Redis } from 'ioredis';

// Create Redis Option
const redisOption = {
  port: 6379,
  host: 'localhost',
  username: '',
  password: '',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  db: 1, //this will be assigned to 1 and stream will be assigned to 2, if you select 4 then it will be assigned to 4 and stream will be assigned to 5
};

// create a streamdb this enhances performance drastically and they get unaffected by the dashboard
const db = new Redis(redisOption);

// Optional: create separate streamdb connection for better performance
const streamdb = new Redis({ ...redisOption, db: redisOption.db + 1 });

// define the context for the app SAMPLE you pass your own context to the tasker so it will be always available, otherwise it will be undefined
const contextApp = {};

// initialize the task manager (using new core_v2 API)
const tempotask = TaskManager.init({
  db,
  streamdb, // Optional: separate connection for streams
  ctx: contextApp,
  concurrency: 1,
  processor: {
    retry: {
      maxRetries: 3,
      retryDelayMs: 1000,
    },
  },
});

export { tempotask };