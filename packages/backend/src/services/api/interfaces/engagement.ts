import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware } from "./middlewares/auth.ts";

// -- Subscription schemas / 订阅 schema --

export class SubscriptionEntry extends Schema.Class<SubscriptionEntry>("SubscriptionEntry")({
  id: Schema.String,
  subscriberUnitId: Schema.String,
  subscribedUnitId: Schema.String,
  channels: Schema.NullOr(Schema.Array(Schema.String)),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class SubscriptionCheckResult extends Schema.Class<SubscriptionCheckResult>("SubscriptionCheckResult")({
  subscribed: Schema.Boolean,
  channels: Schema.optional(Schema.Array(Schema.String)),
}) {}

export class SubscriberCountResult extends Schema.Class<SubscriberCountResult>("SubscriberCountResult")({
  count: Schema.Number,
}) {}

// -- Reaction schemas / 反应 schema --

export class ReactionEntry extends Schema.Class<ReactionEntry>("ReactionEntry")({
  id: Schema.String,
  userId: Schema.String,
  targetId: Schema.String,
  reaction: Schema.String,
  contextUnitId: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
}) {}

export class ShareResult extends Schema.Class<ShareResult>("ShareResult")({
  id: Schema.String,
  created: Schema.Boolean,
}) {}

// -- Feedback schemas / 反馈 schema --

export class FeedbackEntry extends Schema.Class<FeedbackEntry>("FeedbackEntry")({
  id: Schema.String,
  userId: Schema.String,
  url: Schema.NullOr(Schema.String),
  content: Schema.String,
  type: Schema.String,
  resolved: Schema.Boolean,
  resolvedAt: Schema.NullOr(Schema.DateFromString),
  addressedUnitId: Schema.NullOr(Schema.String),
  targetId: Schema.NullOr(Schema.String),
  targetKind: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class FeedbackListResult extends Schema.Class<FeedbackListResult>("FeedbackListResult")({
  items: Schema.Array(FeedbackEntry),
  total: Schema.Number,
}) {}

// -- Block schemas / 屏蔽 schema --

export class BlockEntry extends Schema.Class<BlockEntry>("BlockEntry")({
  userId: Schema.String,
  blockedUserId: Schema.String,
  createdAt: Schema.DateFromString,
}) {}

// -- Progress schemas / 进度 schema --

export class UnitProgressEntry extends Schema.Class<UnitProgressEntry>("UnitProgressEntry")({
  userId: Schema.String,
  unitId: Schema.String,
  status: Schema.NullOr(Schema.String),
  startedAt: Schema.NullOr(Schema.DateFromString),
  finishedAt: Schema.NullOr(Schema.DateFromString),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class UnitProgressListResult extends Schema.Class<UnitProgressListResult>("UnitProgressListResult")({
  items: Schema.Array(UnitProgressEntry),
  total: Schema.Number,
}) {}

// -- Draft schemas / 草稿 schema --

export class DraftEntry extends Schema.Class<DraftEntry>("DraftEntry")({
  unitId: Schema.String,
  type: Schema.String,
  title: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

// -- Activity schemas / 活动 schema --

export class ActivityEntry extends Schema.Class<ActivityEntry>("ActivityEntry")({
  kind: Schema.String,
  unitId: Schema.NullOr(Schema.String),
  data: Schema.Unknown,
  createdAt: Schema.DateFromString,
}) {}

// -- Stream schemas / 信息流 schema --

export class StreamRow extends Schema.Class<StreamRow>("StreamRow")({
  kind: Schema.String,
  id: Schema.String,
  data: Schema.Unknown,
  createdAt: Schema.DateFromString,
}) {}

export class StreamResult extends Schema.Class<StreamResult>("StreamResult")({
  rows: Schema.Array(StreamRow),
  hasMore: Schema.Boolean,
}) {}

// -- Error schemas / 错误 schema --

export class EngagementNotFound extends Schema.TaggedErrorClass<EngagementNotFound>()(
  "EngagementNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class EngagementForbidden extends Schema.TaggedErrorClass<EngagementForbidden>()(
  "EngagementForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class EngagementBadRequest extends Schema.TaggedErrorClass<EngagementBadRequest>()(
  "EngagementBadRequest",
  {},
  { httpApiStatus: 400 },
) {}

// -- Groups / 分组 --

export class SubscriptionGroup extends HttpApiGroup.make("subscriptions")
  .add(
    // POST /subscription/ — create subscription (requires login)
    // POST /subscription/ — 创建订阅（需要登录）
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        subscribedUnitId: Schema.String,
        channels: Schema.optional(Schema.Array(Schema.String)),
      }),
      success: SubscriptionEntry,
      error: HttpApiError.InternalServerError,
    }),
    // GET /subscription/me — list my subscriptions
    // GET /subscription/me — 列出我的订阅
    HttpApiEndpoint.get("listMine", "/me", {
      query: {
        subscribedType: Schema.optional(Schema.String),
      },
      success: Schema.Struct({ subscriptions: Schema.Array(SubscriptionEntry) }),
      error: HttpApiError.InternalServerError,
    }),
    // PATCH /subscription/:subscribedUnitId — update subscription channels
    // PATCH /subscription/:subscribedUnitId — 更新订阅频道
    HttpApiEndpoint.patch("updateChannels", "/:subscribedUnitId", {
      params: { subscribedUnitId: Schema.String },
      payload: Schema.Struct({
        channels: Schema.Array(Schema.String),
      }),
      success: SubscriptionEntry,
      error: [EngagementNotFound, HttpApiError.InternalServerError],
    }),
    // DELETE /subscription/:subscribedUnitId — delete subscription
    // DELETE /subscription/:subscribedUnitId — 删除订阅
    HttpApiEndpoint.delete("delete", "/:subscribedUnitId", {
      params: { subscribedUnitId: Schema.String },
      success: Schema.Struct({ unsubscribed: Schema.Boolean }),
      error: HttpApiError.InternalServerError,
    }),
    // GET /subscription/check/:subscribedUnitId — check subscription status
    // GET /subscription/check/:subscribedUnitId — 检查订阅状态
    HttpApiEndpoint.get("check", "/check/:subscribedUnitId", {
      params: { subscribedUnitId: Schema.String },
      success: SubscriptionCheckResult,
      error: HttpApiError.InternalServerError,
    }),
    // GET /subscription/count/:subscribedUnitId — get subscriber count (public)
    // GET /subscription/count/:subscribedUnitId — 获取订阅者计数（公开）
    HttpApiEndpoint.get("count", "/count/:subscribedUnitId", {
      params: { subscribedUnitId: Schema.String },
      success: SubscriberCountResult,
      error: HttpApiError.InternalServerError,
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/subscription") {}

export class ReactionGroup extends HttpApiGroup.make("reactions")
  .add(
    // POST /reaction/ — create a reaction (requires login)
    // POST /reaction/ — 创建反应（需要登录）
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        targetId: Schema.String,
        reaction: Schema.String,
        contextUnitId: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      success: ReactionEntry,
      error: [EngagementForbidden, HttpApiError.InternalServerError],
    }),
    // DELETE /reaction/ — remove a reaction (requires login)
    // DELETE /reaction/ — 移除反应（需要登录）
    HttpApiEndpoint.delete("remove", "/", {
      query: {
        targetId: Schema.String,
        reaction: Schema.String,
        contextUnitId: Schema.optional(Schema.String),
      },
      success: HttpApiSchema.NoContent,
      error: HttpApiError.InternalServerError,
    }),
    // POST /reaction/share — record a share intent (requires login)
    // POST /reaction/share — 记录分享意图（需要登录）
    HttpApiEndpoint.post("share", "/share", {
      payload: Schema.Struct({
        targetId: Schema.String,
      }),
      success: ShareResult,
      error: [EngagementForbidden, HttpApiError.InternalServerError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/reaction") {}

export class FeedbackGroup extends HttpApiGroup.make("feedback")
  .add(
    // POST /feedback/ — create feedback (requires login)
    // POST /feedback/ — 创建反馈（需要登录）
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        content: Schema.String,
        type: Schema.optional(Schema.String),
        url: Schema.optional(Schema.String),
        addressedUnitId: Schema.optional(Schema.String),
        targetId: Schema.optional(Schema.String),
        targetKind: Schema.optional(Schema.String),
      }),
      success: FeedbackEntry,
      error: HttpApiError.InternalServerError,
    }),
    // GET /feedback/my — list my feedbacks
    // GET /feedback/my — 列出我的反馈
    HttpApiEndpoint.get("listMine", "/my", {
      query: {
        type: Schema.optional(Schema.String),
        resolved: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: FeedbackListResult,
      error: HttpApiError.InternalServerError,
    }),
    // GET /feedback/list — list all feedbacks (admin)
    // GET /feedback/list — 列出所有反馈（管理员）
    HttpApiEndpoint.get("listAll", "/list", {
      query: {
        userId: Schema.optional(Schema.String),
        type: Schema.optional(Schema.String),
        resolved: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: FeedbackListResult,
      error: [EngagementForbidden, HttpApiError.InternalServerError],
    }),
    // PATCH /feedback/:id/resolve — set resolved state (admin)
    // PATCH /feedback/:id/resolve — 设置解决状态（管理员）
    HttpApiEndpoint.patch("resolve", "/:id/resolve", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        resolved: Schema.Boolean,
      }),
      success: FeedbackEntry,
      error: [EngagementNotFound, EngagementForbidden, HttpApiError.InternalServerError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/feedback") {}

export class BlockGroup extends HttpApiGroup.make("blocks")
  .add(
    // GET /block/list — list my blocked users
    // GET /block/list — 列出我屏蔽的用户
    HttpApiEndpoint.get("list", "/list", {
      success: Schema.Struct({ items: Schema.Array(BlockEntry) }),
      error: HttpApiError.InternalServerError,
    }),
    // POST /block/ — block a user
    // POST /block/ — 屏蔽用户
    HttpApiEndpoint.post("add", "/", {
      payload: Schema.Struct({
        userId: Schema.String,
      }),
      success: Schema.Struct({ success: Schema.Boolean }),
      error: [EngagementBadRequest, HttpApiError.InternalServerError],
    }),
    // DELETE /block/:userId — unblock a user
    // DELETE /block/:userId — 取消屏蔽用户
    HttpApiEndpoint.delete("remove", "/:userId", {
      params: { userId: Schema.String },
      success: Schema.Struct({ success: Schema.Boolean }),
      error: HttpApiError.InternalServerError,
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/block") {}

export class ProgressGroup extends HttpApiGroup.make("progress", {
  topLevel: true,
})
  .add(
    // GET /me/units/:unitId/progress — get my unit progress
    // GET /me/units/:unitId/progress — 获取我的 unit 进度
    HttpApiEndpoint.get("get", "/me/units/:unitId/progress", {
      params: { unitId: Schema.String },
      success: Schema.NullOr(UnitProgressEntry),
      error: HttpApiError.InternalServerError,
    }),
    // PUT /me/units/:unitId/progress — upsert my unit progress
    // PUT /me/units/:unitId/progress — 写入或更新我的 unit 进度
    HttpApiEndpoint.put("upsert", "/me/units/:unitId/progress", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        status: Schema.optional(Schema.String),
        startedAt: Schema.optional(Schema.NullOr(Schema.DateFromString)),
        finishedAt: Schema.optional(Schema.NullOr(Schema.DateFromString)),
      }),
      success: UnitProgressEntry,
      error: HttpApiError.InternalServerError,
    }),
    // DELETE /me/units/:unitId/progress — delete my unit progress
    // DELETE /me/units/:unitId/progress — 删除我的 unit 进度
    HttpApiEndpoint.delete("delete", "/me/units/:unitId/progress", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: HttpApiError.InternalServerError,
    }),
    // GET /me/progress — list my unit progress
    // GET /me/progress — 列出我的 unit 进度
    HttpApiEndpoint.get("list", "/me/progress", {
      query: {
        status: Schema.optional(Schema.String),
        unitType: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: UnitProgressListResult,
      error: HttpApiError.InternalServerError,
    }),
    // POST /me/units/:unitId/node-completion — toggle node completion
    // POST /me/units/:unitId/node-completion — 切换节点完成状态
    HttpApiEndpoint.post("nodeCompletion", "/me/units/:unitId/node-completion", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        nodeId: Schema.String,
        isCompleted: Schema.Boolean,
      }),
      success: HttpApiSchema.NoContent,
      error: HttpApiError.InternalServerError,
    }),
  )
  .middleware(AuthMiddleware) {}

export class DraftGroup extends HttpApiGroup.make("drafts", {
  topLevel: true,
})
  .add(
    // GET /me/drafts — list my drafts
    // GET /me/drafts — 列出我的草稿
    HttpApiEndpoint.get("list", "/me/drafts", {
      query: {
        limit: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Struct({ drafts: Schema.Array(DraftEntry) }),
      error: HttpApiError.InternalServerError,
    }),
  )
  .middleware(AuthMiddleware) {}

export class ActivityGroup extends HttpApiGroup.make("activity", {
  topLevel: true,
})
  .add(
    // GET /profile/:userId/activity/ — list public activity timeline
    // GET /profile/:userId/activity/ — 列出公开活动时间线
    HttpApiEndpoint.get("list", "/profile/:userId/activity/", {
      params: { userId: Schema.String },
      query: {
        before: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(ActivityEntry),
      error: HttpApiError.InternalServerError,
    }),
  )
  .middleware(OptionalAuthMiddleware) {}

export class StreamGroup extends HttpApiGroup.make("stream")
  .add(
    // GET /stream/rows — list stream rows
    // GET /stream/rows — 列出信息流行
    HttpApiEndpoint.get("rows", "/rows", {
      query: {
        scope: Schema.optional(Schema.String),
        realmUnitId: Schema.optional(Schema.String),
        before: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
      },
      success: StreamResult,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),
  )
  .prefix("/stream") {}
