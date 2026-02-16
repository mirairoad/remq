import { assert } from "@std/assert";

Deno.test("AdminStore reference matches current API", async () => {
  const docUrl = new URL("../docs/reference/admin-store.md", import.meta.url);
  const content = await Deno.readTextFile(docUrl);

  const requiredSnippets = [
    "AdminStore",
    "management API",
    "CRUD and control for admin UIs",
    "new AdminStore(db: RedisConnection)",
    "const queues = await adminStore.getQueuesInfo()",
    "const failedJobs = await adminStore.listJobs({",
    "await adminStore.retryJob",
    "AdminJobData",
    "## Types",
    "Main fields",
    "timestamps (`timestamp`, `lastRun`, `delayUntil`, `lockUntil`)",
    "status: 'waiting' | 'processing' | 'completed' | 'failed' | 'delayed'",
    "ListJobsOptions",
    "queue is required",
    "JobStats",
    "QueueInfo",
    "getJob(jobId: string, queue: string): Promise<AdminJobData | null>",
    "listJobs(options?: ListJobsOptions): Promise<AdminJobData[]>",
    "deleteJob(jobId: string, queue: string): Promise<void>",
    "queue` (required) - Queue name to list",
    "status` (optional) - Status filter",
    "limit` (optional) - Max number of jobs to return",
    "offset` (optional) - Pagination offset",
    "getQueueStats(queue: string): Promise<JobStats>",
    "Returns a `JobStats` object",
    "getQueues(): Promise<string[]>",
    "getQueuesInfo(): Promise<QueueInfo[]>",
    "QueueInfo` objects (`name` + `stats`)",
    "retryJob",
    "TaskManager.emit()",
    "only failed jobs can be retried",
    "Use this when you need to cancel a job",
  ];

  for (const snippet of requiredSnippets) {
    assert(
      content.includes(snippet),
      `Expected AdminStore reference to include ${snippet}.`,
    );
  }

  const forbiddenSnippets = [
    "cancelJob",
    "pauseQueue",
    "resumeQueue",
    "isQueuePaused",
    "pauseJob",
    "resumeJob",
  ];

  for (const snippet of forbiddenSnippets) {
    assert(
      !content.includes(snippet),
      `Expected AdminStore reference to avoid ${snippet}.`,
    );
  }
});
