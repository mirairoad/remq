import { defineApi } from "../../../howl.config.ts";
import { z } from "zod";
import { readDoc } from "../../docs/reader.ts";

export default defineApi({
  name: "Docs Item",
  directory: "public",
  path: "/api/public/docs/:slug",
  method: "GET",
  roles: [],
  caching: { ttl: 30 },
  params: z.object({ slug: z.string() }),
  responses: {
    200: z.object({ doc: z.any() }),
    404: z.object({ error: z.string() }),
  },
  handler: async (ctx) => {
    const { slug } = ctx.params;
    const doc = await readDoc(slug);
    if (!doc) return { statusCode: 404, error: "Not found" };
    return { statusCode: 200, doc };
  },
});
