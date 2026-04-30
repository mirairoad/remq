import { z } from "zod";
import { defineApi } from "../../../howl.config.ts";

export default defineApi({
  name: "Ping",
  directory: "public",
  method: "GET",
  roles: [],
  rateLimit: { max: 30, windowMs: 60_000 },
  caching: { ttl: 5 },
  responses: {
    200: z.object({
      ok: z.boolean(),
      message: z.string(),
    }),
  },
  handler: () => ({
    statusCode: 200,
    ok: true,
    message: `pong — ${new Date().toISOString()}`,
  }),
});
