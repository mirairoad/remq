/**
 * Core V2 - Main exports
 * 
 * High-level API for task/job management
 */

export { TaskManager } from './libs/task-manager/mod.ts';
export type {
  TaskManagerOptions,
  TaskHandler,
  EmitFunction,
  RegisterHandlerOptions,
} from './types/task-manager.ts';

// Re-export lower-level APIs if needed
export { Processor } from './libs/processor/mod.ts';
export { Consumer } from './libs/consumer/mod.ts';
export type {
  ProcessorOptions,
  ConsumerOptions,
  Message,
  MessageHandler,
} from './types/index.ts';

// Export admin/management API
export { AdminStore } from './libs/admin/mod.ts';
export type {
  AdminJobData,
  ListJobsOptions,
  JobStats,
  QueueInfo,
} from './types/admin.ts';

