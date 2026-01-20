/**
 * TaskManager - High-level API for task/job management
 * 
 * Simple, developer-friendly API built on top of Consumer + Processor
 */

export { TaskManager } from './task-manager.ts';
export type {
  TaskManagerOptions,
  TaskHandler,
  EmitFunction,
  RegisterHandlerOptions,
} from '../../types/task-manager.ts';

