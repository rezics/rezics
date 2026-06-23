import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware, Unauthorized } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — minimal placeholders; flesh out when implementing handlers
// 响应 schema —— 最小占位；实现 handler 时再细化
// ---------------------------------------------------------------------------

export class UserDTO extends Schema.Class<UserDTO>("UserDTO")({
  id: Schema.String,
  name: Schema.optional(Schema.String),
  email: Schema.optional(Schema.String),
  emailVerified: Schema.optional(Schema.Boolean),
  image: Schema.optional(Schema.NullOr(Schema.String)),
  displayName: Schema.optional(Schema.NullOr(Schema.String)),
  createdAt: Schema.optional(Schema.String),
  updatedAt: Schema.optional(Schema.String),
}) {}

export class UserListResult extends Schema.Class<UserListResult>("UserListResult")({
  users: Schema.Array(UserDTO),
  total: Schema.Number,
}) {}

export class UserBriefDTO extends Schema.Class<UserBriefDTO>("UserBriefDTO")({
  unitId: Schema.String,
  name: Schema.optional(Schema.String),
  slug: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  avatar: Schema.optional(Schema.String),
}) {}

export class UserBriefBatchResult extends Schema.Class<UserBriefBatchResult>("UserBriefBatchResult")({
  users: Schema.Array(UserBriefDTO),
}) {}

export class DeleteAccountResult extends Schema.Class<DeleteAccountResult>("DeleteAccountResult")({
  deleted: Schema.Boolean,
}) {}

/** Payload for updating the current user profile. / 更新当前用户资料的请求体。 */
const UpdateMePayload = Schema.Struct({
  name: Schema.optional(Schema.NullOr(Schema.String)),
  avatar: Schema.optional(Schema.NullOr(Schema.String)),
  summary: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
});

/** Payload for updating user settings. / 更新用户设置的请求体。 */
const UpdateSettingsPayload = Schema.Struct({
  defaultLicenseSlug: Schema.optional(Schema.NullOr(Schema.String)),
  realmManageModeDefault: Schema.optional(Schema.NullOr(Schema.Boolean)),
  bookshelfConfig: Schema.optional(Schema.Unknown),
});

/** User settings response. / 用户设置响应。 */
export class UserSettingsDTO extends Schema.Class<UserSettingsDTO>("UserSettingsDTO")({
  defaultLicenseSlug: Schema.NullOr(Schema.String),
  realmManageModeDefault: Schema.NullOr(Schema.Boolean),
  bookshelfConfig: Schema.NullOr(Schema.Unknown),
}) {}

/** Email verification status. / 邮件验证状态。 */
export class EmailVerificationDTO extends Schema.Class<EmailVerificationDTO>("EmailVerificationDTO")({
  email: Schema.NullOr(Schema.String),
  emailVerified: Schema.Boolean,
}) {}

/** Email verification request result. / 邮件验证请求结果。 */
export class EmailVerificationRequestResult extends Schema.Class<EmailVerificationRequestResult>("EmailVerificationRequestResult")({
  message: Schema.String,
}) {}

/** User data export result. / 用户数据导出结果。 */
export class ExportDataResult extends Schema.Class<ExportDataResult>("ExportDataResult")({
  message: Schema.String,
}) {}

/** Payload for admin update of a user. / 管理员更新用户的请求体。 */
const AdminUpdatePayload = Schema.Struct({
  name: Schema.optional(Schema.NullOr(Schema.String)),
  avatar: Schema.optional(Schema.NullOr(Schema.String)),
  summary: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.NullOr(Schema.String)),
});

/** Reaction history entry. / 反应历史条目。 */
export class ReactionHistoryDTO extends Schema.Class<ReactionHistoryDTO>("ReactionHistoryDTO")({
  items: Schema.Array(Schema.Unknown),
  nextCursor: Schema.NullOr(Schema.String),
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UserNotFound extends Schema.TaggedErrorClass<UserNotFound>()(
  "UserNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class UserForbidden extends Schema.TaggedErrorClass<UserForbidden>()(
  "UserForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class UserBadRequest extends Schema.TaggedErrorClass<UserBadRequest>()(
  "UserBadRequest",
  {},
  { httpApiStatus: 400 },
) {}

// ---------------------------------------------------------------------------
// /user — CRUD + settings + email verification + account data + social + brief
// /user — 增删改查 + 设置 + 邮件验证 + 账号数据 + 社交 + 简要信息
// ---------------------------------------------------------------------------

export class UsersGroup extends HttpApiGroup.make("users")
  .add(
    // GET /user/list — list users via query params
    // 通过查询参数列出用户
    HttpApiEndpoint.get("listGet", "/list", {
      query: Schema.Struct({
        q: Schema.optional(Schema.String),
        ids: Schema.optional(Schema.String),
        offset: Schema.optional(Schema.NumberFromString),
        limit: Schema.optional(Schema.NumberFromString),
        sort: Schema.optional(Schema.String),
      }),
      success: UserListResult,
      error: HttpApiError.InternalServerError,
    }),

    // POST /user/list — list users via POST body
    // 通过 POST 请求体列出用户
    HttpApiEndpoint.post("listPost", "/list", {
      payload: Schema.Struct({
        q: Schema.optional(Schema.String),
        ids: Schema.optional(Schema.Array(Schema.String)),
        offset: Schema.optional(Schema.Number),
        limit: Schema.optional(Schema.Number),
        sort: Schema.optional(Schema.String),
      }),
      success: UserListResult,
      error: HttpApiError.InternalServerError,
    }),

    // GET /user/by-slug/:slug — look up user by slug
    // 通过 slug 查找用户
    HttpApiEndpoint.get("getBySlug", "/by-slug/:slug", {
      params: { slug: Schema.String },
      success: UserDTO,
      error: [UserNotFound, HttpApiError.InternalServerError],
    }),

    // GET /user/me — current authenticated user
    // 当前登录用户
    HttpApiEndpoint.get("getMe", "/me", {
      success: UserDTO,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PUT /user/me — update current user profile
    // 更新当前用户资料
    HttpApiEndpoint.put("updateMe", "/me", {
      payload: UpdateMePayload,
      success: UserDTO,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // GET /user/:userId — look up user by unit ID
    // 通过 unitId 查找用户
    HttpApiEndpoint.get("getById", "/:userId", {
      params: { userId: Schema.String },
      success: UserDTO,
      error: [UserNotFound, HttpApiError.InternalServerError],
    }),

    // GET /user/batch — batch fetch user info
    // 批量获取用户信息
    HttpApiEndpoint.get("batch", "/batch", {
      query: Schema.Struct({
        ids: Schema.String,
      }),
      success: Schema.Array(UserDTO),
      error: HttpApiError.InternalServerError,
    }),
  )
  .add(
    // GET /user/me/settings — get current user settings
    // 获取当前用户设置
    HttpApiEndpoint.get("getSettings", "/me/settings", {
      success: UserSettingsDTO,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PUT /user/me/settings — update current user settings
    // 更新当前用户设置
    HttpApiEndpoint.put("updateSettings", "/me/settings", {
      payload: UpdateSettingsPayload,
      success: UserSettingsDTO,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .add(
    // GET /user/me/email-verification — email verification state
    // 获取邮件验证状态
    HttpApiEndpoint.get("getEmailVerification", "/me/email-verification", {
      success: EmailVerificationDTO,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /user/me/email-verification — request email verification
    // 请求邮件验证
    HttpApiEndpoint.post("requestEmailVerification", "/me/email-verification", {
      payload: Schema.Struct({ email: Schema.String }),
      success: EmailVerificationRequestResult,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .add(
    // POST /user/me/export — export user data
    // 导出用户数据
    HttpApiEndpoint.post("exportData", "/me/export", {
      success: ExportDataResult,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /user/me/delete-account — delete account
    // 删除账号
    HttpApiEndpoint.post("deleteAccount", "/me/delete-account", {
      payload: Schema.Struct({ confirmation: Schema.String }),
      success: DeleteAccountResult,
      error: [Unauthorized, UserBadRequest, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .add(
    // GET /user/admin/:userId — admin get user
    // 管理员获取用户
    HttpApiEndpoint.get("adminGet", "/admin/:userId", {
      params: { userId: Schema.String },
      success: UserDTO,
      error: [Unauthorized, UserForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PUT /user/admin/:userId — admin update user
    // 管理员更新用户
    HttpApiEndpoint.put("adminUpdate", "/admin/:userId", {
      params: { userId: Schema.String },
      payload: AdminUpdatePayload,
      success: UserDTO,
      error: [Unauthorized, UserForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /user/admin/:userId — admin delete user
    // 管理员删除用户
    HttpApiEndpoint.delete("adminDelete", "/admin/:userId", {
      params: { userId: Schema.String },
      success: Schema.Struct({ message: Schema.String }),
      error: [Unauthorized, UserForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .add(
    // GET /user/:userId/followers — list followers
    // 获取粉丝列表
    HttpApiEndpoint.get("getFollowers", "/:userId/followers", {
      params: { userId: Schema.String },
      query: Schema.Struct({
        page: Schema.optional(Schema.NumberFromString),
        limit: Schema.optional(Schema.NumberFromString),
      }),
      success: UserListResult,
      error: HttpApiError.InternalServerError,
    }),

    // GET /user/:userId/followings — list followings
    // 获取关注列表
    HttpApiEndpoint.get("getFollowings", "/:userId/followings", {
      params: { userId: Schema.String },
      query: Schema.Struct({
        page: Schema.optional(Schema.NumberFromString),
        limit: Schema.optional(Schema.NumberFromString),
      }),
      success: UserListResult,
      error: HttpApiError.InternalServerError,
    }),
  )
  .add(
    // GET /user/brief/:userId — get user brief
    // 获取用户简要信息
    HttpApiEndpoint.get("getBrief", "/brief/:userId", {
      params: { userId: Schema.String },
      success: UserBriefDTO,
      error: [UserNotFound, HttpApiError.InternalServerError],
    }),

    // POST /user/brief — batch fetch user briefs
    // 批量获取用户简要信息
    HttpApiEndpoint.post("batchBriefs", "/brief", {
      payload: Schema.Struct({
        unitIds: Schema.Array(Schema.String),
      }),
      success: UserBriefBatchResult,
      error: HttpApiError.InternalServerError,
    }),
  )
  .prefix("/user") {}

// ---------------------------------------------------------------------------
// /profile — reaction history (separate prefix, uses OptionalAuthMiddleware)
// /profile — 反应历史（独立前缀，使用可选认证）
// ---------------------------------------------------------------------------

export class ProfileGroup extends HttpApiGroup.make("profile")
  .add(
    // GET /profile/:userId/reaction/given — list given reactions
    // 获取用户发出的反应
    HttpApiEndpoint.get("reactionGiven", "/:userId/reaction/given", {
      params: { userId: Schema.String },
      query: Schema.Struct({
        reactions: Schema.optional(Schema.String),
        cursor: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
      }),
      success: ReactionHistoryDTO,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    // GET /profile/:userId/reaction/received — list received reactions
    // 获取用户收到的反应
    HttpApiEndpoint.get("reactionReceived", "/:userId/reaction/received", {
      params: { userId: Schema.String },
      query: Schema.Struct({
        reactions: Schema.optional(Schema.String),
        cursor: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
      }),
      success: ReactionHistoryDTO,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),
  )
  .prefix("/profile") {}
