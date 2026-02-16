import { TaskManager } from '../core/libs/task-manager/mod.ts';
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

// initialize the task manager (using new core API)
const remq = TaskManager.init({
  db,
  streamdb, // Optional: separate connection for streams
  ctx: contextApp,
  expose: 3000, // the websocket port exposed  to allows consumers to interact from remote
  concurrency: 2, // the number of messages to process concurrently uses workers steal process strategy
  processor: { // [default] processor options
    debounce: 1 * 60, // 100 minutes
    dlq: {
      streamKey: 'remq-dlq', // the stream key to send the failed messages to
      shouldSendToDLQ: (message, error, attempts) => {
        return attempts >= 3; // send to dlq if the message has been retried 3 times
      },
    },
    retry: {
      maxRetries: 3,
      retryDelayMs: 1000,
    },
  },
});

export { remq };
