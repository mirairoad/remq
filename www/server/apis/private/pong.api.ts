import { defineApi } from "../../../howl.config.ts";
import { z } from "zod";

export default defineApi({
  name: "Pong",
  directory: "private",
  method: "POST",
  roles: ["PUBLISHER"],
  rateLimit: { max: 5, windowMs: 3_000 },
  caching: {
    ttl: 5,
  },
  requestBody: z.object({
    name: z.string(),
    email: z.email(),
  }),
  responses: {
    200: z.object({
      ok: z.boolean(),
      message: z.string(),
    }),
  },
  handler: (ctx) => {
    console.log(ctx.req.body.email); // typesafe
    console.log(ctx.req.body.name); // typesafe

    return {
      ok: true,
      message: `pong from howl 🐺 — ${new Date().toISOString()}`,
    };
  },
});
