import { Howl, staticFiles } from "@hushkey/howl";
import { coalesceRequests, compression } from "@hushkey/howl/middleware";
import { apiConfig, type State } from "../howl.config.ts";
import denoJson from "../../core/deno.json" with { type: "json" };

const APP_NAME = Deno.env.get("APP_NAME") ?? "HOUND";
const APP_VERSION = denoJson.version;

export const app = new Howl<State>({
  logger: true,
  debug: true,
});

app.use((ctx) => {
  ctx.state.client = {
    title: APP_NAME,
    version: APP_VERSION,
  };
  return ctx.next();
});

app.use(staticFiles());
app.use(compression());
app.use(coalesceRequests());

app.fsApiRoutes(apiConfig);
app.fsClientRoutes();

export default { app };
