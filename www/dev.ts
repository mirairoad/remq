import { HowlBuilder } from "@hushkey/howl/dev";
import { tailwindPlugin } from "@hushkey/howl/plugins";
import { app } from "./server/main.ts";
import type { State } from "./howl.config.ts";

const builder = new HowlBuilder<State>(app, {
  root: import.meta.dirname ?? "",
  importApp: () => app,
  outDir: "dist",
  serverEntry: "./server/main.ts",
  clientEntry: "./client/pages/_app.ts",
});

tailwindPlugin(builder.getBuilder("default")!);

if (Deno.args.includes("build")) {
  await builder.build();
} else {
  await builder.listen({ port: 3001, hostname: "127.0.0.1" });
}
