import { TaskManager } from '../mod.ts';
import type { RedisConnection } from '../types/redis-client.ts';

Deno.test('TaskManager applies documented defaults and registerHandler queue default', async () => {
  const TaskManagerAny = TaskManager as unknown as { instance?: unknown };
  TaskManagerAny.instance = undefined;

  const fakeRedis = {} as unknown as RedisConnection;
  const manager = TaskManager.init({ db: fakeRedis });
  const internal = manager as unknown as {
    concurrency: number;
    streamdb: unknown;
    ctx: { emit?: unknown };
    processorOptions?: Record<string, unknown>;
    queueStreams: Set<string>;
    handlers: Map<string, unknown>;
  };

  if (internal.concurrency !== 1) {
    throw new Error(`Expected concurrency default 1, got ${internal.concurrency}`);
  }

  if (internal.streamdb !== fakeRedis) {
    throw new Error('Expected streamdb to default to db');
  }

  if (typeof internal.ctx?.emit !== 'function') {
    throw new Error('Expected ctx.emit to be injected');
  }

  if (Object.keys(internal.processorOptions ?? {}).length !== 0) {
    throw new Error('Expected processorOptions to default to {}');
  }

  await manager.registerHandler({
    event: 'default-queue-check',
    handler: () => {},
  });

  if (!internal.queueStreams.has('default-stream')) {
    throw new Error('Expected default queue stream to be registered');
  }

  if (!internal.handlers.has('default:default-queue-check')) {
    throw new Error('Expected default queue handler key to be registered');
  }

  TaskManagerAny.instance = undefined;
});
