import { t } from "elysia";

export const bookSortTypeSchema = t.Enum({
  relevance: "relevance",
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  favorites: "favorites",
  wordCount: "wordCount",
  monthlyVotes: "monthlyVotes",
  recommendation: "recommendation",
  custom: "custom",
});

export const bookQueryOptionsSchema = t.Object({
  keyword: t.Optional(t.String()),
  keywordFields: t.Optional(t.Array(t.String())),
  tags: t.Optional(t.Array(t.String())),
  authorIds: t.Optional(t.Array(t.String())),
  pressIds: t.Optional(t.Array(t.String())),
  producerIds: t.Optional(t.Array(t.String())),
  textLength: t.Optional(t.String()),
  nsfw: t.Optional(t.Boolean()),
  isLicensed: t.Optional(t.Boolean()),
  sort: t.Optional(
    t.Object({
      type: t.Optional(bookSortTypeSchema),
      order: t.Optional(t.Enum({ asc: "asc", desc: "desc" })),
    }),
  ),
  start: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  // use any will lead to errors
  // filter: t.Optional(t.Record(t.String(), t.Any())),
  // experimental: t.Optional(t.Record(t.String(), t.Any())),
});

export type BookQueryOptions = (typeof bookQueryOptionsSchema)["static"];

/**
 * Build a compact search `q` string from structured BookQueryOptions.
 * Example output: "some text [tag] author:123 sort:createdAt:desc"
 */
export function toBookQueryString(opts: BookQueryOptions): string {
  const tokens: string[] = [];
  if (opts.keyword) tokens.push(opts.keyword);
  if (opts.tags?.length) tokens.push(...opts.tags.map((t) => `[${t}]`));
  if (opts.authorIds?.length)
    tokens.push(...opts.authorIds.map((id) => `author:${id}`));
  if (opts.pressIds?.length)
    tokens.push(...opts.pressIds.map((id) => `press:${id}`));
  if (opts.producerIds?.length)
    tokens.push(...opts.producerIds.map((id) => `producer:${id}`));
  if (opts.keywordFields?.length)
    tokens.push(`fields:${opts.keywordFields.join(",")}`);
  if (opts.sort?.type)
    tokens.push(
      `sort:${opts.sort.type}${opts.sort.order ? `:${opts.sort.order}` : ""}`,
    );
  return tokens.join(" ").trim();
}
