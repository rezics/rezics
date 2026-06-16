import type { Static } from "elysia";
import { t } from "elysia";

// ANCHOR: Comment Search Document
// ANCHOR: 评论搜索文档

export const CommentSearchDocumentSchema = t.Object({
  id: t.String(),
  contentText: t.Union([t.String(), t.Null()]),
  rootUnitId: t.String(),
  realmUnitId: t.Union([t.String(), t.Null()]),
  parentCommentId: t.Union([t.String(), t.Null()]),
  authorUserId: t.String(),
  depth: t.Number(),
  isLocked: t.Boolean(),
  replyCount: t.Number(),
  directReplyCount: t.Number(),
  lastReplyAt: t.Union([t.String(), t.Null()]),
  state: t.Union([t.String(), t.Null()]),
  moderationStatus: t.String(),
  createdAt: t.String(),
  updatedAt: t.String(),
  bestScore: t.Number(),
  hotScore: t.Number(),
  topScore: t.Number(),
  risingScore: t.Number(),
  controversyScore: t.Number(),
  qualityScore: t.Number(),
  rankUpdatedAt: t.Union([t.String(), t.Null()]),

  // Denormalized author
  // 反规范化的作者信息
  authorName: t.Union([t.String(), t.Null()]),
  authorSlug: t.Union([t.String(), t.Null()]),
  authorAvatar: t.Union([t.String(), t.Null()]),
});

export type CommentSearchDocument = Static<typeof CommentSearchDocumentSchema>;

// ANCHOR: Comment Search Options
// ANCHOR: 评论搜索选项

export const CommentSearchOptionsSchema = t.Object({
  keyword: t.Optional(t.String()),
  rootUnitId: t.Optional(t.String()),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  parentCommentId: t.Optional(t.Nullable(t.String())),
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
        t.Literal("bestScore"),
        t.Literal("hotScore"),
        t.Literal("topScore"),
        t.Literal("risingScore"),
        t.Literal("controversyScore"),
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
// ANCHOR: 评论搜索结果

export const CommentSearchResultSchema = t.Object({
  items: t.Array(CommentSearchDocumentSchema),
  total: t.Number(),
  processingTimeMs: t.Number(),
  query: t.String(),
});

export type CommentSearchResult = Static<typeof CommentSearchResultSchema>;
