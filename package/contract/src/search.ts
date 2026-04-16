import { t } from "elysia";
import type { Static } from "elysia";
import { SlugRefSchema } from "./common/slug-ref";

// ANCHOR: Search Query

export const SearchQuerySchema = t.Object({
  keyword: t.Optional(t.String()),
  tags: t.Optional(t.Array(SlugRefSchema)),
  type: t.Optional(t.Array(t.String())),
  languages: t.Optional(t.Array(t.String())),
  nsfw: t.Optional(t.Boolean()),
  isLicensed: t.Optional(t.Boolean()),
  realm: t.Optional(SlugRefSchema),
  sort: t.Optional(t.String()),
});

export type SearchQuery = Static<typeof SearchQuerySchema>;
