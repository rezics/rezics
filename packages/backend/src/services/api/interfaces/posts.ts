import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas / 响应 schema
// ---------------------------------------------------------------------------

export class PostDTO extends Schema.Class<PostDTO>("PostDTO")({
  unitId: Schema.String,
  authorUserId: Schema.String,
  kind: Schema.NullOr(Schema.String),
  replyCount: Schema.Number,
  directReplyCount: Schema.Number,
  lastReplyAt: Schema.NullOr(Schema.String),
  isLocked: Schema.Boolean,
  state: Schema.NullOr(Schema.String),
  variantUnitId: Schema.NullOr(Schema.String),
  title: Schema.NullOr(Schema.String),
  summary: Schema.NullOr(Schema.String),
  content: Schema.NullOr(Schema.Unknown),
  slug: Schema.NullOr(Schema.String),
  status: Schema.String,
  visibility: Schema.String,
  language: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class PostListResult extends Schema.Class<PostListResult>("PostListResult")({
  items: Schema.Array(PostDTO),
  total: Schema.Number,
}) {}

export class ModerationOverlayResult extends Schema.Class<ModerationOverlayResult>(
  "ModerationOverlayResult",
)({
  overlays: Schema.Record(Schema.String, Schema.Unknown),
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class PostNotFound extends Schema.TaggedErrorClass<PostNotFound>()(
  "PostNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class PostForbidden extends Schema.TaggedErrorClass<PostForbidden>()(
  "PostForbidden",
  {},
  { httpApiStatus: 403 },
) {}

// ---------------------------------------------------------------------------
// /post — CRUD + moderation + pins + accepted answers
// /post — CRUD + 审核 + 置顶 + 采纳回答
// ---------------------------------------------------------------------------

export class PostsGroup extends HttpApiGroup.make("posts")
  .add(
    HttpApiEndpoint.get("get", "/:unitId", {
      params: { unitId: Schema.String },
      success: PostDTO,
      error: [PostNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        kind: Schema.optional(Schema.String),
        realmUnitId: Schema.optional(Schema.String),
        parentUnitId: Schema.optional(Schema.String),
        title: Schema.optional(Schema.String),
        content: Schema.optional(Schema.Unknown),
        language: Schema.optional(Schema.String),
        variantUnitId: Schema.optional(Schema.String),
      }),
      success: PostDTO,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.patch("update", "/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        title: Schema.optional(Schema.String),
        content: Schema.optional(Schema.Unknown),
        language: Schema.optional(Schema.String),
        variantUnitId: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      success: PostDTO,
      error: [PostNotFound, PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("delete", "/:unitId", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [PostNotFound, PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.get("list", "/list", {
      query: {
        parentUnitId: Schema.optional(Schema.String),
        realmUnitId: Schema.optional(Schema.String),
        authorUserId: Schema.optional(Schema.String),
        kind: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: PostListResult,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    HttpApiEndpoint.post("listByFilter", "/list", {
      payload: Schema.Struct({
        parentUnitId: Schema.optional(Schema.String),
        realmUnitId: Schema.optional(Schema.String),
        authorUserId: Schema.optional(Schema.String),
        kind: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: PostListResult,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    HttpApiEndpoint.post("moderationOverlays", "/moderation-overlays", {
      payload: Schema.Struct({
        unitIds: Schema.Array(Schema.String),
      }),
      success: ModerationOverlayResult,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("publish", "/:unitId/publish", {
      params: { unitId: Schema.String },
      success: PostDTO,
      error: [PostNotFound, PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("submitToRealm", "/:unitId/submit-to-realm", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        realmUnitId: Schema.String,
      }),
      success: PostDTO,
      error: [PostNotFound, PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("setState", "/:unitId/state", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        state: Schema.String,
      }),
      success: PostDTO,
      error: [PostNotFound, PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("createPin", "/pins", {
      payload: Schema.Struct({
        unitId: Schema.String,
        kind: Schema.optional(Schema.String),
      }),
      success: PostDTO,
      error: [PostNotFound, PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("deletePin", "/pins", {
      payload: Schema.Struct({
        unitId: Schema.String,
        kind: Schema.optional(Schema.String),
      }),
      success: HttpApiSchema.NoContent,
      error: [PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.post("acceptAnswer", "/accepted-answers", {
      payload: Schema.Struct({
        postUnitId: Schema.String,
        commentId: Schema.String,
      }),
      success: PostDTO,
      error: [PostNotFound, PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    HttpApiEndpoint.delete("removeAcceptedAnswer", "/accepted-answers", {
      payload: Schema.Struct({
        postUnitId: Schema.String,
        commentId: Schema.String,
      }),
      success: HttpApiSchema.NoContent,
      error: [PostNotFound, PostForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/post") {}
