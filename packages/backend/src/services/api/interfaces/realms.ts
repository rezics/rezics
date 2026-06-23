import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — minimal placeholders; flesh out when implementing handlers
// 响应 schema —— 最小占位；实现 handler 时再细化
// ---------------------------------------------------------------------------

export class Realm extends Schema.Class<Realm>("Realm")({
  id: Schema.String,
  slug: Schema.String,
  name: Schema.String,
}) {}

export class RealmMember extends Schema.Class<RealmMember>("RealmMember")({
  userId: Schema.String,
  realmUnitId: Schema.String,
  role: Schema.String,
}) {}

export class RealmRuleEntry extends Schema.Class<RealmRuleEntry>("RealmRuleEntry")({
  id: Schema.String,
  realmUnitId: Schema.String,
  title: Schema.String,
}) {}

export class RealmRuleRevision extends Schema.Class<RealmRuleRevision>("RealmRuleRevision")({
  id: Schema.String,
  ruleId: Schema.String,
}) {}

export class RealmContentEntry extends Schema.Class<RealmContentEntry>("RealmContentEntry")({
  id: Schema.String,
  realmUnitId: Schema.String,
  contentUnitId: Schema.String,
}) {}

export class RealmDock extends Schema.Class<RealmDock>("RealmDock")({
  realmUnitId: Schema.String,
}) {}

export class RealmTagTree extends Schema.Class<RealmTagTree>("RealmTagTree")({
  realmUnitId: Schema.String,
}) {}

export class RealmTagApplication extends Schema.Class<RealmTagApplication>("RealmTagApplication")({
  realmUnitId: Schema.String,
  unitId: Schema.String,
  tagUnitId: Schema.String,
}) {}

export class RealmTagApplicationVote extends Schema.Class<RealmTagApplicationVote>("RealmTagApplicationVote")({
  id: Schema.String,
}) {}

export class RealmTagContext extends Schema.Class<RealmTagContext>("RealmTagContext")({
  realmUnitId: Schema.String,
  tagUnitId: Schema.String,
}) {}

export class PinboardEntry extends Schema.Class<PinboardEntry>("PinboardEntry")({
  id: Schema.String,
  realmUnitId: Schema.String,
  key: Schema.String,
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class RealmNotFound extends Schema.TaggedErrorClass<RealmNotFound>()(
  "RealmNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class RealmForbidden extends Schema.TaggedErrorClass<RealmForbidden>()(
  "RealmForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class RealmSlugConflict extends Schema.TaggedErrorClass<RealmSlugConflict>()(
  "RealmSlugConflict",
  {},
  { httpApiStatus: 409 },
) {}

export class RealmMemberNotFound extends Schema.TaggedErrorClass<RealmMemberNotFound>()(
  "RealmMemberNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class RealmAlreadyMember extends Schema.TaggedErrorClass<RealmAlreadyMember>()(
  "RealmAlreadyMember",
  {},
  { httpApiStatus: 409 },
) {}

export class RealmContentNotFound extends Schema.TaggedErrorClass<RealmContentNotFound>()(
  "RealmContentNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class RealmTagApplicationNotFound extends Schema.TaggedErrorClass<RealmTagApplicationNotFound>()(
  "RealmTagApplicationNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class PinboardNotFound extends Schema.TaggedErrorClass<PinboardNotFound>()(
  "PinboardNotFound",
  {},
  { httpApiStatus: 404 },
) {}

// ---------------------------------------------------------------------------
// /realm — core CRUD + lookup
// ---------------------------------------------------------------------------

export class RealmsGroup extends HttpApiGroup.make("realms")
  .add(
    // GET /realm/me — list realms the current user belongs to
    // 获取当前用户加入的 realm 列表
    HttpApiEndpoint.get("listMine", "/me", {
      success: Schema.Array(Realm),
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    // GET /realm/member/:userId — list realms a specific user belongs to
    // 获取指定用户加入的 realm 列表
    HttpApiEndpoint.get("listByMember", "/member/:userId", {
      params: { userId: Schema.String },
      success: Schema.Array(Realm),
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    // GET /realm/by-slug/:slug
    HttpApiEndpoint.get("getBySlug", "/by-slug/:slug", {
      params: { slug: Schema.String },
      success: Realm,
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // GET /realm/list — paginated list (query-string filters)
    // POST /realm/list — paginated list (body filters)
    HttpApiEndpoint.get("list", "/list", {
      query: {
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(Realm),
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    HttpApiEndpoint.post("listByFilter", "/list", {
      payload: Schema.Struct({
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: Schema.Array(Realm),
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    // GET /realm/:unitId
    HttpApiEndpoint.get("getById", "/:unitId", {
      params: { unitId: Schema.String },
      success: Realm,
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // POST /realm/ — create realm
    // 创建 realm
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        name: Schema.String,
        slug: Schema.String,
        description: Schema.optional(Schema.String),
      }),
      success: Realm,
      error: [RealmSlugConflict, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PUT /realm/:unitId — update realm
    // 更新 realm
    HttpApiEndpoint.put("update", "/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        name: Schema.optional(Schema.String),
        slug: Schema.optional(Schema.String),
        description: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      success: Realm,
      error: [RealmNotFound, RealmForbidden, RealmSlugConflict, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /realm/:unitId — delete realm
    // 删除 realm
    HttpApiEndpoint.delete("delete", "/:unitId", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Members — /realm/:unitId/members/*
    // -----------------------------------------------------------------------

    // GET /realm/:unitId/members/me — current user's membership in this realm
    // 获取当前用户在此 realm 的成员信息
    HttpApiEndpoint.get("getMyMembership", "/:unitId/members/me", {
      params: { unitId: Schema.String },
      success: Schema.NullOr(RealmMember),
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // GET /realm/:unitId/members — list members
    // 列出成员
    HttpApiEndpoint.get("listMembers", "/:unitId/members", {
      params: { unitId: Schema.String },
      query: {
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(RealmMember),
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // POST /realm/:unitId/members — add/join member
    // 添加/加入成员
    HttpApiEndpoint.post("addMember", "/:unitId/members", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        userId: Schema.optional(Schema.String),
      }),
      success: RealmMember,
      error: [RealmNotFound, RealmForbidden, RealmAlreadyMember, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PUT /realm/:unitId/members/:userId — update member role
    // 更新成员角色
    HttpApiEndpoint.put("updateMember", "/:unitId/members/:userId", {
      params: { unitId: Schema.String, userId: Schema.String },
      payload: Schema.Struct({
        role: Schema.optional(Schema.String),
      }),
      success: RealmMember,
      error: [RealmNotFound, RealmMemberNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /realm/:unitId/members/:userId — remove member
    // 移除成员
    HttpApiEndpoint.delete("removeMember", "/:unitId/members/:userId", {
      params: { unitId: Schema.String, userId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmMemberNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Rules — /realm/:unitId/rules/*
    // -----------------------------------------------------------------------

    // GET /realm/:unitId/rules/resolved — rules with inheritance resolved
    // 获取继承解析后的规则
    HttpApiEndpoint.get("getResolvedRules", "/:unitId/rules/resolved", {
      params: { unitId: Schema.String },
      success: Schema.Array(RealmRuleEntry),
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // GET /realm/:unitId/rules — list rules
    // 列出规则
    HttpApiEndpoint.get("listRules", "/:unitId/rules", {
      params: { unitId: Schema.String },
      success: Schema.Array(RealmRuleEntry),
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // POST /realm/:unitId/rules — create rule
    // 创建规则
    HttpApiEndpoint.post("createRule", "/:unitId/rules", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        title: Schema.String,
        description: Schema.optional(Schema.String),
        position: Schema.optional(Schema.Number),
      }),
      success: RealmRuleEntry,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /realm/:unitId/rules/revisions — create rule revision
    // 创建规则修订
    HttpApiEndpoint.post("createRuleRevision", "/:unitId/rules/revisions", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        ruleId: Schema.String,
        reason: Schema.optional(Schema.String),
      }),
      success: RealmRuleRevision,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /realm/:unitId/rules/acknowledgement — acknowledge rules
    // 确认已阅读规则
    HttpApiEndpoint.post("acknowledgeRules", "/:unitId/rules/acknowledgement", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Mute — /realm/:unitId/mute, /realm/:unitId/unmute
    // -----------------------------------------------------------------------

    // POST /realm/:unitId/mute
    HttpApiEndpoint.post("mute", "/:unitId/mute", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /realm/:unitId/unmute
    HttpApiEndpoint.post("unmute", "/:unitId/unmute", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Content — /realm/:unitId/content
    // -----------------------------------------------------------------------

    // POST /realm/:unitId/content — add content to realm
    // 向 realm 添加内容
    HttpApiEndpoint.post("addContent", "/:unitId/content", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        contentUnitId: Schema.String,
      }),
      success: RealmContentEntry,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /realm/:unitId/content/:contentUnitId — remove content from realm
    // 从 realm 移除内容
    HttpApiEndpoint.delete("removeContent", "/:unitId/content/:contentUnitId", {
      params: { unitId: Schema.String, contentUnitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmContentNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Tags — /realm/:unitId/tags
    // -----------------------------------------------------------------------

    // POST /realm/:unitId/tags — add tags to realm
    // 向 realm 添加标签
    HttpApiEndpoint.post("addTags", "/:unitId/tags", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        tagUnitIds: Schema.Array(Schema.String),
      }),
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /realm/:unitId/tags — remove tags from realm
    // 从 realm 移除标签
    HttpApiEndpoint.delete("removeTags", "/:unitId/tags", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        tagUnitIds: Schema.Array(Schema.String),
      }),
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Dock — /realm/:unitId/dock
    // -----------------------------------------------------------------------

    // GET /realm/:unitId/dock
    HttpApiEndpoint.get("getDock", "/:unitId/dock", {
      params: { unitId: Schema.String },
      success: RealmDock,
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // PUT /realm/:unitId/dock
    HttpApiEndpoint.put("updateDock", "/:unitId/dock", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        items: Schema.Array(Schema.Struct({ key: Schema.String, value: Schema.String })),
      }),
      success: RealmDock,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Extra — /realm/:unitId/extra/:key
    // -----------------------------------------------------------------------

    // PUT /realm/:unitId/extra/:key
    HttpApiEndpoint.put("setExtra", "/:unitId/extra/:key", {
      params: { unitId: Schema.String, key: Schema.String },
      payload: Schema.Struct({
        value: Schema.Unknown,
      }),
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /realm/:unitId/extra/:key
    HttpApiEndpoint.delete("deleteExtra", "/:unitId/extra/:key", {
      params: { unitId: Schema.String, key: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Tag tree — /realm/:unitId/tag-tree
    // -----------------------------------------------------------------------

    // GET /realm/:unitId/tag-tree
    HttpApiEndpoint.get("getTagTree", "/:unitId/tag-tree", {
      params: { unitId: Schema.String },
      success: RealmTagTree,
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // PUT /realm/:unitId/tag-tree
    HttpApiEndpoint.put("updateTagTree", "/:unitId/tag-tree", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        tree: Schema.Unknown,
      }),
      success: RealmTagTree,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // -----------------------------------------------------------------------
    // Pinboards — /realm/:unitId/pinboards/:key
    // -----------------------------------------------------------------------

    // GET /realm/:unitId/pinboards/:key
    HttpApiEndpoint.get("getPinboard", "/:unitId/pinboards/:key", {
      params: { unitId: Schema.String, key: Schema.String },
      success: PinboardEntry,
      error: [RealmNotFound, PinboardNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // POST /realm/:unitId/pinboards/:key — add entry to pinboard
    // 向钉板添加条目
    HttpApiEndpoint.post("addPinboardEntry", "/:unitId/pinboards/:key", {
      params: { unitId: Schema.String, key: Schema.String },
      payload: Schema.Struct({
        unitId: Schema.String,
      }),
      success: PinboardEntry,
      error: [RealmNotFound, RealmForbidden, PinboardNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /realm/:unitId/pinboards/:key/reorder — reorder pinboard
    // 重新排序钉板
    HttpApiEndpoint.post("reorderPinboard", "/:unitId/pinboards/:key/reorder", {
      params: { unitId: Schema.String, key: Schema.String },
      payload: Schema.Struct({
        orderedIds: Schema.Array(Schema.String),
      }),
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmForbidden, PinboardNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /realm/:unitId/pinboards/:key/entry — delete pinboard entry
    // 删除钉板条目
    HttpApiEndpoint.delete("deletePinboardEntry", "/:unitId/pinboards/:key/entry", {
      params: { unitId: Schema.String, key: Schema.String },
      payload: Schema.Struct({
        entryId: Schema.String,
      }),
      success: HttpApiSchema.NoContent,
      error: [RealmNotFound, RealmForbidden, PinboardNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/realm") {}

// ---------------------------------------------------------------------------
// /realm-tag-application — tag applications on realm content
// ---------------------------------------------------------------------------

export class RealmTagApplicationsGroup extends HttpApiGroup.make("realmTagApplications")
  .add(
    // POST /realm-tag-application/ — create tag application
    // 创建标签申请
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        realmUnitId: Schema.String,
        unitId: Schema.String,
        tagUnitId: Schema.String,
      }),
      success: RealmTagApplication,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // GET /realm-tag-application/:realmUnitId/:unitId — list tag applications for a unit
    // 获取某个 unit 上的标签申请列表
    HttpApiEndpoint.get("listForUnit", "/:realmUnitId/:unitId", {
      params: { realmUnitId: Schema.String, unitId: Schema.String },
      success: Schema.Array(RealmTagApplication),
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // PATCH /realm-tag-application/:realmUnitId/:unitId/:tagUnitId — update tag application
    // 更新标签申请
    HttpApiEndpoint.patch("update", "/:realmUnitId/:unitId/:tagUnitId", {
      params: { realmUnitId: Schema.String, unitId: Schema.String, tagUnitId: Schema.String },
      payload: Schema.Struct({
        status: Schema.optional(Schema.String),
      }),
      success: RealmTagApplication,
      error: [RealmTagApplicationNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /realm-tag-application/:realmUnitId/:unitId/:tagUnitId — delete tag application
    // 删除标签申请
    HttpApiEndpoint.delete("delete", "/:realmUnitId/:unitId/:tagUnitId", {
      params: { realmUnitId: Schema.String, unitId: Schema.String, tagUnitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [RealmTagApplicationNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/realm-tag-application") {}

// ---------------------------------------------------------------------------
// /realm-tag-application-vote — votes on tag applications
// ---------------------------------------------------------------------------

export class RealmTagApplicationVotesGroup extends HttpApiGroup.make("realmTagApplicationVotes")
  .add(
    // POST /realm-tag-application-vote/ — cast vote
    // 投票
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        realmUnitId: Schema.String,
        unitId: Schema.String,
        tagUnitId: Schema.String,
        direction: Schema.Literals(["up", "down"]),
      }),
      success: RealmTagApplicationVote,
      error: [RealmTagApplicationNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /realm-tag-application-vote/ — retract vote
    // 撤回投票
    HttpApiEndpoint.delete("delete", "/", {
      payload: Schema.Struct({
        realmUnitId: Schema.String,
        unitId: Schema.String,
        tagUnitId: Schema.String,
      }),
      success: HttpApiSchema.NoContent,
      error: [RealmTagApplicationNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/realm-tag-application-vote") {}

// ---------------------------------------------------------------------------
// /realm-tag-context — contextual tag metadata within a realm
// ---------------------------------------------------------------------------

export class RealmTagContextsGroup extends HttpApiGroup.make("realmTagContexts")
  .add(
    // GET /realm-tag-context/:realmUnitId/:tagUnitId
    HttpApiEndpoint.get("get", "/:realmUnitId/:tagUnitId", {
      params: { realmUnitId: Schema.String, tagUnitId: Schema.String },
      success: RealmTagContext,
      error: [RealmNotFound, HttpApiError.InternalServerError],
    }).middleware(OptionalAuthMiddleware),

    // PUT /realm-tag-context/:realmUnitId/:tagUnitId
    HttpApiEndpoint.put("update", "/:realmUnitId/:tagUnitId", {
      params: { realmUnitId: Schema.String, tagUnitId: Schema.String },
      payload: Schema.Struct({
        description: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      success: RealmTagContext,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // POST /realm-tag-context/:realmUnitId/:tagUnitId/materialize
    HttpApiEndpoint.post("materialize", "/:realmUnitId/:tagUnitId/materialize", {
      params: { realmUnitId: Schema.String, tagUnitId: Schema.String },
      success: RealmTagContext,
      error: [RealmNotFound, RealmForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/realm-tag-context") {}
