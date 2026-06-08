import type { Static } from "elysia";
import { t } from "elysia";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { paginationLimitSchema } from "../pagination";
import { pinKindLiterals } from "../post/post";
import {
  moderationAuthoritySchema,
  moderationStatusSchema,
} from "../realm/governance";
import { publicUserSchema } from "../unit/unit";

// ANCHOR: Comment DTO
// ANCHOR: 评论 DTO

export const commentDTOSchema = t.Object({
  id: t.String(),
  /** @deprecated Use `id`. This is the comment row id, not a Unit id. */
  unitId: t.String(),
  rootUnitId: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  parentCommentId: t.Optional(t.Nullable(t.String())),
  authorUserId: t.Optional(t.Nullable(t.String())),
  author: t.Optional(publicUserSchema),
  content: t.Optional(t.Nullable(contentDocSchema)),
  moderationStatus: moderationStatusSchema,
  removedReason: t.Optional(t.Nullable(t.String())),
  removedByAuthority: t.Optional(t.Nullable(moderationAuthoritySchema)),
  isRedacted: t.Optional(t.Boolean()),
  redactionKind: t.Optional(
    t.Nullable(
      t.Union([t.Literal("moderator_removed"), t.Literal("author_deleted")]),
    ),
  ),
  depth: t.Number(),
  replyCount: t.Optional(t.Number()),
  directReplyCount: t.Optional(t.Number()),
  lastReplyAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  isLocked: t.Optional(t.Boolean()),
  state: t.Optional(t.Nullable(t.String())),
  pinKind: t.Optional(t.Nullable(pinKindLiterals)),
  pinPosition: t.Optional(t.Nullable(t.String())),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type CommentDTO = Static<typeof commentDTOSchema>;

// ANCHOR: Comment List
// ANCHOR: 评论列表

export const commentSliceModeSchema = t.Union([
  t.Literal("discovery"),
  t.Literal("root"),
  t.Literal("children"),
]);

export type CommentSliceMode = Static<typeof commentSliceModeSchema>;

export const commentSortModeSchema = t.Union([
  t.Literal("best"),
  t.Literal("top"),
  t.Literal("rising"),
  t.Literal("controversial"),
  t.Literal("new"),
  t.Literal("old"),
]);

export type CommentSortMode = Static<typeof commentSortModeSchema>;

export const commentSliceCursorSchema = t.Object({
  id: t.String(),
  sortValue: t.Optional(t.Union([t.String(), t.Number()])),
  createdAt: t.Optional(t.String()),
});

export type CommentSliceCursor = Static<typeof commentSliceCursorSchema>;

export const commentListQuerySchema = t.Object({
  rootUnitId: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  mode: commentSliceModeSchema,
  rootCommentId: t.Optional(t.String()),
  parentCommentId: t.Optional(t.Nullable(t.String())),
  authorUserId: t.Optional(t.String()),
  state: t.Optional(t.String()),
  sort: t.Optional(commentSortModeSchema),
  cursor: t.Optional(commentSliceCursorSchema),
  limit: paginationLimitSchema,
});

export type CommentListQuery = Static<typeof commentListQuerySchema>;

export const commentListBodySchema = t.Object({
  rootUnitId: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  mode: commentSliceModeSchema,
  rootCommentId: t.Optional(t.String()),
  parentCommentId: t.Optional(t.Nullable(t.String())),
  authorUserId: t.Optional(t.String()),
  state: t.Optional(t.String()),
  sort: t.Optional(commentSortModeSchema),
  cursor: t.Optional(commentSliceCursorSchema),
  limit: paginationLimitSchema,
});

export type CommentListBody = Static<typeof commentListBodySchema>;

export const commentListResponseSchema = t.Object({
  mode: commentSliceModeSchema,
  comments: t.Array(commentDTOSchema),
  rootComment: t.Optional(t.Nullable(commentDTOSchema)),
  parentContexts: t.Optional(t.Array(commentDTOSchema)),
  nextCursor: t.Optional(t.Nullable(commentSliceCursorSchema)),
  total: t.Optional(t.Number()),
  /**
   * Thread read only: whether the current caller may pin/accept within this
   * root comment partition. Mirrors the post promotion write guard.
   * 仅用于线程读取：当前调用者是否可以在该根评论分区内置顶/采纳。与帖子提升的
   * 写入守卫保持一致。
   */
  viewerCanPromote: t.Optional(t.Boolean()),
  /**
   * Thread read only: whether the root bears the reserved Q&A tag, which gates
   * accepted-answer affordances for direct comments.
   * 仅用于线程读取：根是否带有保留的问答标签，该标签决定了直接评论的“采纳答案”
   * 功能是否可用。
   */
  isQuestionThread: t.Optional(t.Boolean()),
});

export type CommentListResponse = Static<typeof commentListResponseSchema>;

// ANCHOR: Comment Write
// ANCHOR: 评论写入

export const createCommentSchema = t.Object({
  rootUnitId: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  parentCommentId: t.Optional(t.String()),
  content: contentDocWriteSchema,
});

export type CreateCommentInput = Static<typeof createCommentSchema>;

export const updateCommentSchema = t.Object({
  content: t.Optional(contentDocWriteSchema),
  isLocked: t.Optional(t.Boolean()),
  state: t.Optional(t.Nullable(t.String())),
});

export type UpdateCommentInput = Static<typeof updateCommentSchema>;

export const commentModerationActionSchema = t.Union([
  t.Literal("remove"),
  t.Literal("restore"),
  t.Literal("lock"),
  t.Literal("unlock"),
]);

export const commentModerationInputSchema = t.Object({
  action: commentModerationActionSchema,
  reasonCode: t.String(),
  reasonText: t.Optional(t.Nullable(t.String())),
  publicMessage: t.Optional(t.Nullable(t.String())),
  caseId: t.Optional(t.Nullable(t.String())),
  requestId: t.Optional(t.Nullable(t.String())),
  idempotencyKey: t.Optional(t.Nullable(t.String())),
});

export type CommentModerationAction = Static<
  typeof commentModerationActionSchema
>;
export type CommentModerationInput = Static<
  typeof commentModerationInputSchema
>;

export const commentParamsSchema = t.Object({
  id: t.String(),
});

export type CommentParams = Static<typeof commentParamsSchema>;

export const commentResponseSchema = commentDTOSchema;
export type CommentResponse = Static<typeof commentResponseSchema>;
