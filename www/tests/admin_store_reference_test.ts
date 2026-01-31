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
    "cancelJob",
    "pauseQueue",
    "resumeQueue",
    "isQueuePaused",
    "pauseJob",
    "resumeJob",
    "only failed jobs can be retried",
    "only those can be",
    "These methods do not throw if the queue has no jobs or is unknown.",
    "`pauseJob` throws if the job status is not `waiting` or `delayed`",
  ];

  for (const snippet of requiredSnippets) {
    assert(
      content.includes(snippet),
      `Expected AdminStore reference to include ${snippet}.`,
    );
  }
});
