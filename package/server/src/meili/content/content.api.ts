import { ContentSearchOptionsSchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { searchContent } from "./content.service";

export const contentSearchApi = new Elysia().post(
  "/search/content",
  async ({ body }) => {
    return searchContent(body);
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
