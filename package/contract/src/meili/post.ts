import type { Static } from "elysia";
import { t } from "elysia";
import { unitWorkRoleSchema } from "../unit/work";

// ANCHOR: Post Search Document

export const PostSearchDocumentSchema = t.Object({
  id: t.String(),
  contentText: t.Union([t.String(), t.Null()]),
  kind: t.Union([t.String(), t.Null()]),
  depth: t.Number(),
  isLocked: t.Boolean(),
  replyCount: t.Number(),
  directReplyCount: t.Number(),
  lastReplyAt: t.Union([t.String(), t.Null()]),
  createdAt: t.String(),
  updatedAt: t.String(),
  hotScore: t.Number(),
  topScore: t.Number(),
  trendingScore: t.Number(),
  qualityScore: t.Number(),
  rankUpdatedAt: t.Union([t.String(), t.Null()]),
  commentHotScore: t.Number(),
  commentTopScore: t.Number(),
  commentQualityScore: t.Number(),
  commentRankUpdatedAt: t.Union([t.String(), t.Null()]),

  // Foreign keys (filterable)
  targetUnitId: t.Union([t.String(), t.Null()]),
  rootTargetUnitId: t.Union([t.String(), t.Null()]),
  rootTargetUnitType: t.Union([t.String(), t.Null()]),
  realmIds: t.Array(t.String()),
  workUnitIds: t.Array(t.String()),
  workRoles: t.Array(unitWorkRoleSchema),
  rootPostUnitId: t.Union([t.String(), t.Null()]),
  parentPostUnitId: t.Union([t.String(), t.Null()]),
  authorUserId: t.String(),
  scoreEntryId: t.Union([t.String(), t.Null()]),

  // Denormalized author
  authorName: t.Union([t.String(), t.Null()]),
  authorSlug: t.Union([t.String(), t.Null()]),
  authorAvatar: t.Union([t.String(), t.Null()]),

  // Denormalized target unit
  targetTitles: t.Union([t.Array(t.String()), t.Null()]),
  targetType: t.Union([t.String(), t.Null()]),
  targetCoverUrl: t.Union([t.String(), t.Null()]),

  // Denormalized score
  scoreValue: t.Union([t.Number(), t.Null()]),
  scoreFields: t.Union([t.Record(t.String(), t.Number()), t.Null()]),

  // Extra
  extra: t.Optional(t.Any()),
});

export type PostSearchDocument = Static<typeof PostSearchDocumentSchema>;

// ANCHOR: Post Search Options

export const PostSearchOptionsSchema = t.Object({
  keyword: t.Optional(t.String()),
  kind: t.Optional(t.String()),
  targetUnitId: t.Optional(t.String()),
  rootTargetUnitId: t.Optional(t.String()),
  rootTargetUnitType: t.Optional(t.String()),
  realmUnitId: t.Optional(t.String()),
  workUnitId: t.Optional(t.String()),
  workRoles: t.Optional(t.Array(unitWorkRoleSchema)),
  authorUserId: t.Optional(t.String()),
  rootPostUnitId: t.Optional(t.String()),
  parentPostUnitId: t.Optional(t.String()),
  depth: t.Optional(t.Number()),
  isLocked: t.Optional(t.Boolean()),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("createdAt"),
        t.Literal("updatedAt"),
        t.Literal("replyCount"),
        t.Literal("hotScore"),
        t.Literal("topScore"),
        t.Literal("trendingScore"),
        t.Literal("qualityScore"),
        t.Literal("commentHotScore"),
        t.Literal("commentTopScore"),
        t.Literal("commentQualityScore"),
        t.Literal("relevance"),
      ]),
      order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
  ),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type PostSearchOptions = Static<typeof PostSearchOptionsSchema>;

// ANCHOR: Post Search Result

export const PostSearchResultSchema = t.Object({
  items: t.Array(PostSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type PostSearchResult = Static<typeof PostSearchResultSchema>;
