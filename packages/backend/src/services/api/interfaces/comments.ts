import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas / 响应 schema
// ---------------------------------------------------------------------------

export class CommentDTO extends Schema.Class<CommentDTO>("CommentDTO")({
  id: Schema.String,
  rootUnitId: Schema.String,
  realmUnitId: Schema.NullOr(Schema.String),
  parentCommentId: Schema.NullOr(Schema.String),
  authorUserId: Schema.String,
  content: Schema.NullOr(Schema.Unknown),
  language: Schema.String,
  depth: Schema.Number,
  replyCount: Schema.Number,
  directReplyCount: Schema.Number,
  lastReplyAt: Schema.NullOr(Schema.String),
  isLocked: Schema.Boolean,
  state: Schema.NullOr(Schema.String),
  moderationStatus: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  deletedAt: Schema.NullOr(Schema.String),
}) {}

export class CommentListResult extends Schema.Class<CommentListResult>("CommentListResult")({
  items: Schema.Array(CommentDTO),
  total: Schema.Number,
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class CommentNotFound extends Schema.TaggedErrorClass<CommentNotFound>()(
  "CommentNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class CommentForbidden extends Schema.TaggedErrorClass<CommentForbidden>()(
  "CommentForbidden",
  {},
  { httpApiStatus: 403 },
) {}

// ---------------------------------------------------------------------------
// /comment — CRUD + moderation
// ---------------------------------------------------------------------------

export class CommentsGroup extends HttpApiGroup.make("comments")
  .add(
    // GET /comment/:id — get a single comment
    // 获取单个评论
    HttpApiEndpoint.get("get", "/:id", {
      params: { id: Schema.String },
      success: CommentDTO,
      error: [CommentNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // GET /comment/list — paginated list (query-string filters)
    // 分页列表（查询字符串过滤）
    HttpApiEndpoint.get("list", "/list", {
      query: {
        rootUnitId: Schema.optional(Schema.String),
        realmUnitId: Schema.optional(Schema.String),
        parentCommentId: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: CommentListResult,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    // POST /comment/list — paginated list (body filters)
    // 分页列表（请求体过滤）
    HttpApiEndpoint.post("listByFilter", "/list", {
      payload: Schema.Struct({
        rootUnitId: Schema.optional(Schema.String),
        realmUnitId: Schema.optional(Schema.String),
        parentCommentId: Schema.optional(Schema.NullOr(Schema.String)),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: CommentListResult,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    // POST /comment/ — create comment
    // 创建评论
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        rootUnitId: Schema.String,
        realmUnitId: Schema.optional(Schema.String),
        parentCommentId: Schema.optional(Schema.String),
        content: Schema.Unknown,
        language: Schema.optional(Schema.String),
      }),
      success: CommentDTO,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    // PATCH /comment/:id — update comment
    // 更新评论
    HttpApiEndpoint.patch("update", "/:id", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        content: Schema.optional(Schema.Unknown),
        language: Schema.optional(Schema.String),
      }),
      success: CommentDTO,
      error: [CommentNotFound, CommentForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /comment/:id/moderation — moderate a comment
    // 审核评论
    HttpApiEndpoint.post("moderate", "/:id/moderation", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        status: Schema.String,
        reason: Schema.optional(Schema.String),
      }),
      success: CommentDTO,
      error: [CommentNotFound, CommentForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /comment/:id — delete comment
    // 删除评论
    HttpApiEndpoint.delete("delete", "/:id", {
      params: { id: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [CommentNotFound, CommentForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/comment") {}
