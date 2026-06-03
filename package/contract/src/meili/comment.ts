import type { Static } from "elysia";
import { t } from "elysia";

// ANCHOR: Comment Search Document

export const CommentSearchDocumentSchema = t.Object({
  id: t.String(),
  contentText: t.Union([t.String(), t.Null()]),
  rootUnitId: t.String(),
  realmUnitId: t.Union([t.String(), t.Null()]),
  parentCommentId: t.Union([t.String(), t.Null()]),
  authorUserId: t.String(),
  depth: t.Number(),
  path: t.Union([t.String(), t.Null()]),
  isLocked: t.Boolean(),
  replyCount: t.Number(),
  directReplyCount: t.Number(),
  lastReplyAt: t.Union([t.String(), t.Null()]),
  state: t.Union([t.String(), t.Null()]),
  moderationStatus: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
  hotScore: t.Number(),
  topScore: t.Number(),
  qualityScore: t.Number(),
  rankUpdatedAt: t.Union([t.String(), t.Null()]),

  // Denormalized author
  authorName: t.Union([t.String(), t.Null()]),
  authorSlug: t.Union([t.String(), t.Null()]),
  authorAvatar: t.Union([t.String(), t.Null()]),
});

export type CommentSearchDocument = Static<typeof CommentSearchDocumentSchema>;

// ANCHOR: Comment Search Options

export const CommentSearchOptionsSchema = t.Object({
  keyword: t.Optional(t.String()),
  rootUnitId: t.Optional(t.String()),
  realmUnitId: t.Optional(t.String()),
  parentCommentId: t.Optional(t.String()),
  subtreeRootCommentId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  depth: t.Optional(t.Number()),
  isLocked: t.Optional(t.Boolean()),
  state: t.Optional(t.String()),
  moderationStatus: t.Optional(t.String()),
  sort: t.Optional(
    t.Object({
      field: t.Union([
        t.Literal("createdAt"),
        t.Literal("updatedAt"),
        t.Literal("replyCount"),
        t.Literal("hotScore"),
        t.Literal("topScore"),
        t.Literal("qualityScore"),
        t.Literal("relevance"),
      ]),
      order: t.Optional(t.Union([t.Literal("asc"), t.Literal("desc")])),
    }),
  ),
  offset: t.Optional(t.Number()),
  limit: t.Optional(t.Number()),
});

export type CommentSearchOptions = Static<typeof CommentSearchOptionsSchema>;

// ANCHOR: Comment Search Result

export const CommentSearchResultSchema = t.Object({
  items: t.Array(CommentSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type CommentSearchResult = Static<typeof CommentSearchResultSchema>;
