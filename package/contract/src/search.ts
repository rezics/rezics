import type { Static } from "elysia";
import { t } from "elysia";
import { SlugRefSchema } from "./slug/slug-ref";
import { TagRefSchema } from "./common/tag-ref";
import { postKindLiterals } from "./post";
import { contentRatingSchema } from "./unit";

// ANCHOR: Search Query

export const TextLengthRangeSchema = t.Object({
  min: t.Optional(t.Number()),
  max: t.Optional(t.Number()),
});

export type TextLengthRange = Static<typeof TextLengthRangeSchema>;

export const SearchQuerySchema = t.Object({
  keyword: t.Optional(t.String()),
  tags: t.Optional(t.Array(TagRefSchema)),
  type: t.Optional(t.Array(t.String())),
  postKind: t.Optional(t.Array(postKindLiterals)),
  kind: t.Optional(postKindLiterals),
  languages: t.Optional(t.Array(t.String())),
  ratings: t.Optional(t.Array(contentRatingSchema)),
  isLicensed: t.Optional(t.Boolean()),
  realm: t.Optional(SlugRefSchema),
  sort: t.Optional(t.String()),
  textLength: t.Optional(TextLengthRangeSchema),
});

export type SearchQuery = Static<typeof SearchQuerySchema>;
