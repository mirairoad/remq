import { defineApi } from "../../../howl.config.ts";
import { z } from "zod";

export default defineApi({
  name: "Ping",
  directory: "public",
  method: "GET",
  roles: [],
  rateLimit: { max: 5, windowMs: 3_000, blockDurationMs: 10_000 },
  caching: {
    ttl: 5,
  },
  query: z.object({
    pagination: z.string().optional(),
    limit: z.string().optional(),
  }),
  responses: {
    200: z.object({
      ok: z.boolean(),
      message: z.string(),
    }),
  },
  handler: (ctx) => {
    // ctx.req.body typesafe
    const { pagination, limit } = ctx.query(); // typesafe

    console.log(pagination, limit);

    return {
      statusCode: 200,
      ok: true,
      message: `pong from howl 🐺 — ${new Date().toISOString()}`,
    };
  },
});
