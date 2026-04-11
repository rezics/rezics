import { t } from "elysia";
import { publicUserSchema } from "./unit";

// ============================================================
// POST DTO (replaces Comment, Review, Note, Remark)
// ============================================================

export const postDTOSchema = t.Object({
  unitId: t.String(),
  authorUserId: t.String(),
  author: t.Optional(publicUserSchema),
  targetUnitId: t.Optional(t.Nullable(t.String())),
  realmUnitId: t.Optional(t.Nullable(t.String())),
  body: t.Optional(t.Nullable(t.String())),
  rootPostUnitId: t.Optional(t.Nullable(t.String())),
  parentPostUnitId: t.Optional(t.Nullable(t.String())),
  kind: t.Optional(t.Nullable(t.String())),
  depth: t.Optional(t.Number()),
  sortPath: t.Optional(t.Nullable(t.String())),
  replyCount: t.Optional(t.Number()),
  directReplyCount: t.Optional(t.Number()),
  lastReplyAt: t.Optional(t.Nullable(t.Union([t.String(), t.Date()]))),
  isLocked: t.Optional(t.Boolean()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
  reactionSummaries: t.Optional(t.Any()),
  createdAt: t.Optional(t.Union([t.String(), t.Date()])),
  updatedAt: t.Optional(t.Union([t.String(), t.Date()])),
});

export type PostDTO = (typeof postDTOSchema)["static"];

// ============================================================
// POST LIST/QUERY
// ============================================================

export const postListQuerySchema = t.Object({
  targetUnitId: t.Optional(t.String()),
  realmUnitId: t.Optional(t.String()),
  rootPostUnitId: t.Optional(t.String()),
  parentPostUnitId: t.Optional(t.String()),
  authorUserId: t.Optional(t.String()),
  kind: t.Optional(t.String()),
  mode: t.Optional(t.String()),
  maxDepth: t.Optional(t.Number()),
  sort: t.Optional(
    t.Object({
      field: t.Optional(t.String()),
      order: t.Optional(t.String()),
    }),
  ),
  start: t.Optional(t.Number()),
  cursor: t.Optional(
    t.Object({
      unitId: t.Optional(t.String()),
      createdAt: t.Optional(t.String()),
      sortPath: t.Optional(t.String()),
    }),
  ),
  limit: t.Optional(t.Number()),
});

export type PostListQuery = (typeof postListQuerySchema)["static"];

export const postListResponseSchema = t.Object({
  posts: t.Array(postDTOSchema),
  total: t.Optional(t.Number()),
});

export type PostListResponse = (typeof postListResponseSchema)["static"];

// ============================================================
// POST PARAMS/RESPONSE
// ============================================================

export const postParamsSchema = t.Object({
  unitId: t.String(),
});

export type PostParams = (typeof postParamsSchema)["static"];

export const postResponseSchema = postDTOSchema;
export type PostResponse = (typeof postResponseSchema)["static"];

// ============================================================
// CREATE/UPDATE POST
// ============================================================

export const createPostSchema = t.Object({
  targetUnitId: t.Optional(t.String()),
  realmUnitId: t.Optional(t.String()),
  parentPostUnitId: t.Optional(t.String()),
  kind: t.Optional(t.String()),
  body: t.String(),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type CreatePostInput = (typeof createPostSchema)["static"];

export const updatePostSchema = t.Object({
  body: t.Optional(t.String()),
  isLocked: t.Optional(t.Boolean()),
  extra: t.Optional(t.Nullable(t.Record(t.String(), t.Any()))),
});

export type UpdatePostInput = (typeof updatePostSchema)["static"];
