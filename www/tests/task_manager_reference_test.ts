import { assert } from "@std/assert";

Deno.test("TaskManager reference matches current API", async () => {
  const docUrl = new URL("../docs/reference/task-manager.md", import.meta.url);
  const content = await Deno.readTextFile(docUrl);

  const requiredSnippets = [
    "TaskManager.init",
    "registerHandler",
    "emit",
    "Minimal example",
    "send-welcome",
    "ctx.emit",
    "start()",
    "delayUntil",
    "retryDelayMs",
    "retryCount",
    "priority",
    "repeat",
    "attempts",
    "debounce",
    "id",
  ];

  for (const snippet of requiredSnippets) {
    assert(
      content.includes(snippet),
      `Expected TaskManager reference to include ${snippet}.`,
    );
  }

  assert(
    !content.includes("schedule("),
    "Expected TaskManager reference to remove schedule() placeholder.",
  );

  assert(
    !content.includes("new TaskManager"),
    "Expected TaskManager reference to avoid constructor usage.",
  );
});
