/**
 * Admin/Management API module
 * 
 * Provides simple CRUD operations for job management in admin interfaces
 */

export { AdminStore } from './admin-store.ts';
export type {
  AdminJobData,
  ListJobsOptions,
  JobStats,
  QueueInfo,
} from '../../types/admin.ts';
