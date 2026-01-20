/**
 * Processor module - policy layer for message processing
 * 
 * Handles:
 * - Retries with exponential backoff
 * - Delays (delayUntil)
 * - DLQ routing
 * - Debouncing
 * 
 * Wraps Consumer and adds business logic policies
 */

export { Processor } from './processor.ts';
export { DebounceManager } from './debounce-manager.ts';
export type {
  ProcessorOptions,
  ProcessableMessage,
  RetryConfig,
  DLQConfig,
  DebounceConfig,
} from '../../types/processor.ts';

