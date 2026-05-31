import type { Static } from "elysia";
import { t } from "elysia";
import { contentDocSchema, contentDocWriteSchema } from "../content/doc-v1";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";
import { paginationLimitSchema } from "../pagination";
import { publicUserSchema } from "../unit/unit";

// ANCHOR: Comment DTO

export const commentDTOSchema = t.Object({
  unitId: t.String(),
  rootUnitId: t.String(),
  realmUnitId: t.String(),
  parentCommentUnitId: t.Optional(t.Nullable(t.String())),
  authorUserId: t.String(),
  author: t.Optional(publicUserSchema),
  content: t.Optional(t.Nullable(contentDocSchema)),
  depth: t.Number(),
  path: t.Optional(t.Nullable(t.String())),
  replyCount: t.Optional(t.Number()),
  directReplyCount: t.Optional(t.Number()),
  lastReplyAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  isLocked: t.Optional(t.Boolean()),
  state: t.Optional(t.Nullable(t.String())),
  isTombstone: t.Optional(t.Boolean()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type CommentDTO = Static<typeof commentDTOSchema>;

// ANCHOR: Comment List

export const commentListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  rootUnitId: t.String(),
  realmUnitId: t.String(),
  parentCommentUnitId: t.Optional(t.String()),
  subtreeRootCommentUnitId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  state: t.Optional(t.String()),
  mode: t.Optional(t.Union([t.Literal("children"), t.Literal("subtree")])),
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
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: paginationLimitSchema,
});

export type CommentListQuery = Static<typeof commentListQuerySchema>;

export const commentListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  rootUnitId: t.String(),
  realmUnitId: t.String(),
  parentCommentUnitId: t.Optional(t.String()),
  subtreeRootCommentUnitId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  state: t.Optional(t.String()),
  mode: t.Optional(t.Union([t.Literal("children"), t.Literal("subtree")])),
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
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
    }),
  ),
  limit: paginationLimitSchema,
});

export type CommentListBody = Static<typeof commentListBodySchema>;

export const commentListResponseSchema = t.Object({
  comments: t.Array(commentDTOSchema),
  total: t.Optional(t.Number()),
});

export type CommentListResponse = Static<typeof commentListResponseSchema>;

// ANCHOR: Comment Write

export const createCommentSchema = t.Object({
  rootUnitId: t.String(),
  realmUnitId: t.String(),
  parentCommentUnitId: t.Optional(t.String()),
  content: contentDocWriteSchema,
});

export type CreateCommentInput = Static<typeof createCommentSchema>;

export const updateCommentSchema = t.Object({
  content: t.Optional(contentDocWriteSchema),
  isLocked: t.Optional(t.Boolean()),
  state: t.Optional(t.Nullable(t.String())),
});

export type UpdateCommentInput = Static<typeof updateCommentSchema>;

export const commentParamsSchema = t.Object({
  unitId: t.String(),
});

export type CommentParams = Static<typeof commentParamsSchema>;

export const commentResponseSchema = commentDTOSchema;
export type CommentResponse = Static<typeof commentResponseSchema>;
