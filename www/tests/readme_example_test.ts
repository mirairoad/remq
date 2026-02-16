import { assert } from "@std/assert";

Deno.test("README includes minimal up-and-running example flow", async () => {
  const readmeUrl = new URL("../../README.md", import.meta.url);
  const content = await Deno.readTextFile(readmeUrl);

  assert(
    content.includes("## Up-and-running example"),
    "README should include an up-and-running example section.",
  );
  assert(
    content.includes("TaskManager.init"),
    "README example should include TaskManager.init.",
  );
  assert(
    content.includes("registerHandler"),
    "README example should include registerHandler.",
  );
  assert(
    content.includes("emit({"),
    "README example should include emit call.",
  );
  assert(
    content.includes("start()"),
    "README example should include start call.",
  );
});
