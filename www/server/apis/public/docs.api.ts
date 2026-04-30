import { z } from "zod";
import { defineApi } from "../../../howl.config.ts";
import { readManifest } from "../../docs/reader.ts";

export default defineApi({
  name: "Docs Manifest",
  directory: "public",
  method: "GET",
  roles: [],
  caching: { ttl: 30 },
  responses: {
    200: z.object({
      items: z.array(
        z.object({
          slug: z.string(),
          title: z.string(),
          description: z.string(),
          order: z.number(),
        }),
      ),
    }),
  },
  handler: () => ({ statusCode: 200, items: readManifest() }),
});
