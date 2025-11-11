import { assertEquals } from 'jsr:@std/assert@1/equals';
import type { RedisConnection } from '../src/types/index.ts';
import { QueueManager } from '../src/libs/queue-manager.ts';

Deno.test('registerJob creates workers consumer group', async () => {
  const xgroupCalls: unknown[][] = [];

  const createRedisMock = (dbIndex = 0): RedisConnection => {
    const redisMock = {
      options: { db: dbIndex },
      duplicate: ({ db }: { db: number }) => createRedisMock(db),
      async xgroup(...args: unknown[]) {
        xgroupCalls.push(args);
      },
      async set() {
        return 'OK';
      },
      async get() {
        return null;
      },
      async del() {
        return 0;
      },
      async scan() {
        return ['0', []] as [string, string[]];
      },
      async watch() {
        return 'OK';
      },
      async unwatch() {
        return 'OK';
      },
      multi() {
        return {
          async exec() {
            return [];
          },
        };
      },
      async xadd() {
        return '0-0';
      },
      async xtrim() {
        return 'OK';
      },
      async xreadgroup() {
        return [];
      },
    } as unknown as RedisConnection;

    return redisMock;
  };

  const redis = createRedisMock(0);

  Reflect.set(
    QueueManager as unknown as Record<string, unknown>,
    'instance',
    undefined,
  );

  const manager = QueueManager.init({
    db: redis,
    ctx: {},
    concurrency: 1,
    options: { maxJobsPerStatus: 200 },
  });

  manager.registerJob({
    name: 'test-job',
    queue: 'test-queue',
    handler: async () => {},
  });

  await Promise.resolve();

  assertEquals(xgroupCalls.length, 1);
  assertEquals(xgroupCalls[0], [
    'CREATE',
    'test-queue-stream',
    'workers',
    '$',
    'MKSTREAM',
  ]);
});
