import { assert } from "@std/assert";

Deno.test("admin dashboard guide introduces AdminStore workflows", async () => {
  const docUrl = new URL("../docs/guide/admin-dashboard.md", import.meta.url);
  const content = await Deno.readTextFile(docUrl);

  const requiredSnippets = [
    "AdminStore",
    "getQueuesInfo",
    "getQueueStats",
    "listJobs",
    "getJob",
    "retryJob",
    "deleteJob",
    "TaskManager.emit",
    "/reference/admin-store",
    "full options and types",
  ];

  for (const snippet of requiredSnippets) {
    assert(
      content.includes(snippet),
      `Expected admin dashboard guide to include ${snippet}.`,
    );
  }

  const forbiddenSnippets = [
    "pauseQueue",
    "resumeQueue",
    "isQueuePaused",
    "pauseJob",
    "resumeJob",
    "cancelJob",
  ];

  for (const snippet of forbiddenSnippets) {
    assert(
      !content.includes(snippet),
      `Expected admin dashboard guide to avoid ${snippet}.`,
    );
  }
});
