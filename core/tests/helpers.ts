import { InMemoryStorage } from '../libs/storage/in-memory.ts';
import { Hound } from '../libs/hound/mod.ts';

export function makeDb(): InMemoryStorage {
  return new InMemoryStorage();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Run a test with a fresh, isolated Hound instance.
 * Handles singleton reset + stop automatically.
 */
export async function withHound<T>(
  fn: (hound: Hound<any>, db: InMemoryStorage) => Promise<T>,
  overrides: Record<string, unknown> = {},
): Promise<T> {
  Hound._reset();
  const db = makeDb();
  const hound = Hound.create({
    concurrency: 10,
    processor: { pollIntervalMs: 50, jobStateTtlSeconds: 60 },
    ...overrides,
    db,
  } as any);
  try {
    return await fn(hound, db);
  } finally {
    await hound.stop();
    Hound._reset();
  }
}
