import { t } from "elysia";
import { languageSchema } from "../language";
import { readLanguageGetQueryBase } from "../list-query-base";
import { postDTOSchema } from "../post/post";
import { moderationStatusSchema } from "../realm/governance";
import { shelfSummaryDTOSchema } from "../shelf/shelf";
import { variantContextSummarySchema } from "../unit/unit";

export const feedScopeSchema = t.Union([
  t.Literal("home"),
  t.Literal("realm"),
  t.Literal("zone"),
  t.Literal("library"),
]);

export type FeedScope = (typeof feedScopeSchema)["static"];

export const feedSortSchema = t.Union([
  t.Literal("best"),
  t.Literal("hot"),
  t.Literal("new"),
  t.Literal("top"),
  t.Literal("rising"),
]);

export type FeedSort = (typeof feedSortSchema)["static"];

export const feedCursorSchema = t.Object({
  rowId: t.String(),
  sortValue: t.Optional(t.Union([t.Number(), t.String()])),
  createdAt: t.Optional(t.String()),
});

export type FeedCursor = (typeof feedCursorSchema)["static"];

export const feedQuerySchema = t.Object({
  ...readLanguageGetQueryBase.properties,
  scope: t.Optional(feedScopeSchema),
  realmUnitId: t.Optional(t.String()),
  zoneUnitId: t.Optional(t.String()),
  libraryKind: t.Optional(t.String()),
  targetUnitId: t.Optional(t.String()),
  variantUnitId: t.Optional(t.String()),
  tagIds: t.Optional(t.Array(t.String())),
  realmModerationStatus: t.Optional(
    t.Union([moderationStatusSchema, t.Literal("all")]),
  ),
  languages: t.Optional(t.Union([t.String(), t.Array(languageSchema)])),
  sort: t.Optional(feedSortSchema),
  cursor: t.Optional(feedCursorSchema),
  limit: t.Optional(t.Number({ minimum: 1, maximum: 50 })),
});

export type FeedQuery = (typeof feedQuerySchema)["static"];

export const feedTitleSchema = t.Object({
  key: t.String(),
  params: t.Optional(t.Record(t.String(), t.String())),
});

export const feedWorkSummarySchema = t.Object({
  unitId: t.String(),
  kind: t.Optional(t.String()),
  title: t.Optional(t.Nullable(t.String())),
  coverUrl: t.Optional(t.Nullable(t.String())),
  description: t.Optional(t.Nullable(t.String())),
});

export type FeedWorkSummary = (typeof feedWorkSummarySchema)["static"];

export const feedPostRowSchema = t.Object({
  type: t.Literal("post"),
  rowId: t.String(),
  post: postDTOSchema,
  href: t.String(),
  realm: t.Optional(
    t.Nullable(
      t.Object({
        unitId: t.String(),
        slug: t.Optional(t.Nullable(t.String())),
        title: t.Optional(t.Nullable(t.String())),
      }),
    ),
  ),
  targetUnit: t.Optional(t.Nullable(feedWorkSummarySchema)),
  variantContext: t.Optional(t.Nullable(variantContextSummarySchema)),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type FeedPostRow = (typeof feedPostRowSchema)["static"];

export const feedBookRowSchema = t.Object({
  type: t.Literal("book"),
  rowId: t.String(),
  book: feedWorkSummarySchema,
  href: t.String(),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type FeedBookRow = (typeof feedBookRowSchema)["static"];

export const feedShelfRowSchema = t.Object({
  type: t.Literal("shelf"),
  rowId: t.String(),
  shelf: shelfSummaryDTOSchema,
  href: t.String(),
  recommendationReason: t.Optional(t.Nullable(t.String())),
});

export type FeedShelfRow = (typeof feedShelfRowSchema)["static"];

export const feedRowSchema = t.Union([
  feedPostRowSchema,
  feedBookRowSchema,
  feedShelfRowSchema,
]);

export type FeedRow = (typeof feedRowSchema)["static"];

export const feedResponseSchema = t.Object({
  scope: feedScopeSchema,
  sort: feedSortSchema,
  rows: t.Array(feedRowSchema),
  nextCursor: t.Optional(t.Nullable(feedCursorSchema)),
});

export type FeedResponse = (typeof feedResponseSchema)["static"];
