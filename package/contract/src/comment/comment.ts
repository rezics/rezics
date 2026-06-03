import type { Static } from "elysia";
import { t } from "elysia";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import { pinKindLiterals } from "../post/post";
import {
  moderationAuthoritySchema,
  moderationStatusSchema,
} from "../realm/governance";
import { publicUserSchema } from "../unit/unit";

// ANCHOR: Comment DTO

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
  path: t.Optional(t.Nullable(t.String())),
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

export const commentListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  rootUnitId: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  parentCommentId: t.Optional(t.String()),
  subtreeRootCommentId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  state: t.Optional(t.String()),
  mode: t.Optional(
    t.Union([
      t.Literal("children"),
      t.Literal("threaded"),
      t.Literal("subtree"),
    ]),
  ),
  maxDepth: t.Optional(t.Number()),
  sort: t.Optional(
    t.Union([
      t.Literal("new"),
      t.Literal("top"),
      t.Literal("hot"),
      t.Object({
        field: t.Optional(t.String()),
        order: t.Optional(t.String()),
      }),
    ]),
  ),
  cursor: t.Optional(
    t.Object({
      id: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: paginationLimitSchema,
});

export type CommentListQuery = Static<typeof commentListQuerySchema>;

export const commentListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  rootUnitId: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  parentCommentId: t.Optional(t.String()),
  subtreeRootCommentId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  state: t.Optional(t.String()),
  mode: t.Optional(
    t.Union([
      t.Literal("children"),
      t.Literal("threaded"),
      t.Literal("subtree"),
    ]),
  ),
  maxDepth: t.Optional(t.Number()),
  sort: t.Optional(
    t.Union([
      t.Literal("new"),
      t.Literal("top"),
      t.Literal("hot"),
      t.Object({
        field: t.Optional(t.String()),
        order: t.Optional(t.String()),
      }),
    ]),
  ),
  cursor: t.Optional(
    t.Object({
      id: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: paginationLimitSchema,
});

export type CommentListBody = Static<typeof commentListBodySchema>;

export const commentListResponseSchema = t.Object({
  comments: t.Array(commentDTOSchema),
  total: t.Optional(t.Number()),
  /**
   * Thread read only: whether the current caller may pin/accept within this
   * root comment partition. Mirrors the post promotion write guard.
   */
  viewerCanPromote: t.Optional(t.Boolean()),
  /**
   * Thread read only: whether the root bears the reserved Q&A tag, which gates
   * accepted-answer affordances for direct comments.
   */
  isQuestionThread: t.Optional(t.Boolean()),
});

export type CommentListResponse = Static<typeof commentListResponseSchema>;

// ANCHOR: Comment Write

export const createCommentSchema = t.Object({
  rootUnitId: t.String(),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  parentCommentId: t.Optional(t.String()),
  content: contentDocWriteSchema,
});

export type CreateCommentInput = Static<typeof createCommentSchema>;

export const updateCommentSchema = t.Object({
  content: t.Optional(contentDocWriteSchema),
  realmUnitId: t.Optional(t.Nullable(t.String())),
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
