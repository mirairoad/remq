import { Remq } from '@core/mod.ts';
import { RemqManagement } from '@core/mod.ts';
import { Redis } from 'ioredis';

const redisOption = {
  port: 6379,
  host: 'localhost',
  username: '',
  password: '',
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  db: 1,
};

const db = new Redis(redisOption);
db.on('error', (err) => console.warn('[remq] Redis error:', err.message));

const contextApp = {
  foo: 'bar',
};

const remq = Remq.create({
  db,
  ctx: contextApp,
  expose: 4000,
  concurrency: 10,
  processor: {
    pollIntervalMs: 1,
    claimCount: 200,
    maxLogsPerJob: 100,
    jobStateTtlSeconds: 604800, // 7 days
  },
});

const management = new RemqManagement({ db, remq });

export { management, remq };
