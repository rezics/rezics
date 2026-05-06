import { ContentSearchOptionsSchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { tryResolveIdentity } from "@/middleware/permission";
import {
  deriveAllowedRatings,
  intersectRatings,
} from "@/user/service/allowed-ratings";
import { searchContent } from "./content.service";

export const contentSearchApi = new Elysia().post(
  "/search/content",
  async ({ body, headers }) => {
    const identity = await tryResolveIdentity(
      (headers as Record<string, string | undefined>)["authorization"],
    );
    const allowed = await deriveAllowedRatings(identity?.userId ?? null);
    const ratings = intersectRatings(allowed, body.ratings);
    return searchContent({ ...body, ratings });
  },
  {
    body: ContentSearchOptionsSchema,
    detail: {
      summary: "Search content (unified Meilisearch)",
      description:
        "Server-mediated search across all content types (books, games, media, shelves) via the unified content index.",
      tags: ["Meili", "Content", "Search"],
    },
  },
);
