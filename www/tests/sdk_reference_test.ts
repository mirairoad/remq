import { assert } from "@std/assert";

Deno.test("RemqAdmin reference matches current API", async () => {
  const docUrl = new URL("../docs/reference/sdk.md", import.meta.url);
  const content = await Deno.readTextFile(docUrl);

  const requiredSnippets = [
    "RemqAdmin",
    "management",
    "CRUD and control",
    "new RemqAdmin(db:",
    "const queues = await admin.getQueuesInfo()",
    "const failedJobs = await admin.listJobs({",
    "await admin.retryJob",
    "Job",
    "## Types",
    "ListOptions",
    "required and missing it throws",
    "QueueStats",
    "QueueInfo",
    "getJob(jobId: string, queue: string): Promise<Job | null>",
    "listJobs(options?: ListOptions): Promise<Job[]>",
    "deleteJob(jobId: string, queue: string): Promise<void>",
    "getQueueStats(queue: string): Promise<QueueStats>",
    "getQueues(): Promise<string[]>",
    "getQueuesInfo(): Promise<QueueInfo[]>",
    "retryJob",
    "remq.emit()",
    "job status is not",
  ];

  for (const snippet of requiredSnippets) {
    assert(
      content.includes(snippet),
      `Expected RemqAdmin reference to include ${snippet}.`,
    );
  }
});
