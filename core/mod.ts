import { HandlerOptions, JobDefinition, JobHandler } from './types/index.ts';

/**
 * Type-safe job definition factory.
 * Use instead of remq.on() directly when you want ctx.data typed.
 *
 * @example
 * const syncJob = defineJob<AppCtx, { propertyId: number }>({
 *   event: 'property.sync',
 *   handler: async (ctx) => {
 *     ctx.data.propertyId // ← typed as number
 *   },
 *   options: { queue: 'sync', attempts: 3 }
 * })
 *
 * remq.on(syncJob)
 */
export function defineJob<
  TApp extends Record<string, unknown> = Record<string, unknown>,
  TData = unknown,
>(
  event: string,
  handler: JobHandler<TApp, TData>,
  options?: HandlerOptions,
): JobDefinition<TApp, TData> {
  return { event, handler, options };
}

export { Remq } from './libs/remq/mod.ts';
export { RemqManagement } from './libs/remq-management/mod.ts';
