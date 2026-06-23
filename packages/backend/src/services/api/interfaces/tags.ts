import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware } from "./middlewares/auth.ts";

// -- Response schemas / 响应 schema --

export class TagUnitEntry extends Schema.Class<TagUnitEntry>("TagUnitEntry")({
  unitId: Schema.String,
  slug: Schema.NullOr(Schema.String),
  name: Schema.NullOr(Schema.String),
  language: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
}) {}

export class UnitTagEntry extends Schema.Class<UnitTagEntry>("UnitTagEntry")({
  unitId: Schema.String,
  tagUnitId: Schema.String,
  score: Schema.Number,
  voteCount: Schema.Number,
  pinned: Schema.Boolean,
  position: Schema.NullOr(Schema.String),
  belowVisibilityThreshold: Schema.optional(Schema.Boolean),
  viewerVote: Schema.NullOr(Schema.Number),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class TagListResult extends Schema.Class<TagListResult>("TagListResult")({
  tags: Schema.Array(TagUnitEntry),
  total: Schema.Number,
}) {}

export class BatchTagTranslationEntry extends Schema.Class<BatchTagTranslationEntry>("BatchTagTranslationEntry")({
  unitId: Schema.String,
  name: Schema.NullOr(Schema.String),
  slug: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.String),
}) {}

export class PolicyTagRuleEntry extends Schema.Class<PolicyTagRuleEntry>("PolicyTagRuleEntry")({
  id: Schema.String,
  scopeKind: Schema.String,
  realmUnitId: Schema.NullOr(Schema.String),
  tagUnitId: Schema.String,
  state: Schema.String,
  reason: Schema.NullOr(Schema.String),
  createdByUserId: Schema.String,
  updatedByUserId: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class PolicyTagRuleListResult extends Schema.Class<PolicyTagRuleListResult>("PolicyTagRuleListResult")({
  rules: Schema.Array(PolicyTagRuleEntry),
  total: Schema.Number,
}) {}

export class PolicyTagApplicationEntry extends Schema.Class<PolicyTagApplicationEntry>("PolicyTagApplicationEntry")({
  id: Schema.String,
  ruleId: Schema.String,
  unitId: Schema.String,
  position: Schema.NullOr(Schema.String),
  metadata: Schema.NullOr(Schema.Unknown),
  appliedByUserId: Schema.String,
  updatedByUserId: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class PolicyTagApplicationListResult extends Schema.Class<PolicyTagApplicationListResult>(
  "PolicyTagApplicationListResult",
)({
  applications: Schema.Array(PolicyTagApplicationEntry),
  total: Schema.Number,
}) {}

export class UserTagApplicationEntry extends Schema.Class<UserTagApplicationEntry>("UserTagApplicationEntry")({
  userId: Schema.String,
  unitId: Schema.String,
  tagUnitId: Schema.String,
  position: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

// -- Error schemas / 错误 schema --

export class TagNotFound extends Schema.TaggedErrorClass<TagNotFound>()(
  "TagNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class TagForbidden extends Schema.TaggedErrorClass<TagForbidden>()(
  "TagForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class TagBadRequest extends Schema.TaggedErrorClass<TagBadRequest>()(
  "TagBadRequest",
  {},
  { httpApiStatus: 400 },
) {}

export class TagConflict extends Schema.TaggedErrorClass<TagConflict>()(
  "TagConflict",
  {},
  { httpApiStatus: 409 },
) {}

// -- Groups / 分组 --

export class TagsGroup extends HttpApiGroup.make("tags")
  .add(
    // GET /tag/list — list tags with optional name search and language filter
    // GET /tag/list — 列出标签，支持可选的名称搜索和语言过滤
    HttpApiEndpoint.get("list", "/list", {
      query: {
        language: Schema.optional(Schema.String),
        name: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: TagListResult,
      error: HttpApiError.InternalServerError,
    }),
    // POST /tag/list — list tags via POST body (for large id sets)
    // POST /tag/list — 通过 POST 请求体列出标签（用于大量 ID 集合）
    HttpApiEndpoint.post("listPost", "/list", {
      payload: Schema.Struct({
        language: Schema.optional(Schema.String),
        name: Schema.optional(Schema.String),
        ids: Schema.optional(Schema.Array(Schema.String)),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
      }),
      success: TagListResult,
      error: HttpApiError.InternalServerError,
    }),
    // GET /tag/batch-translations — resolve translations for a batch of tag unit IDs
    // GET /tag/batch-translations — 批量解析标签 unit ID 的翻译
    HttpApiEndpoint.get("batchTranslations", "/batch-translations", {
      query: {
        unitIds: Schema.String,
        lang: Schema.optional(Schema.String),
      },
      success: Schema.Record(Schema.String, BatchTagTranslationEntry),
      error: HttpApiError.InternalServerError,
    }),
    // GET /tag/by-slug/:slug — look up a tag by its slug
    // GET /tag/by-slug/:slug — 按 slug 查找标签
    HttpApiEndpoint.get("getBySlug", "/by-slug/:slug", {
      params: { slug: Schema.String },
      success: TagUnitEntry,
      error: [TagNotFound, HttpApiError.InternalServerError],
    }),
    // GET /tag/:unitId — get a tag by its unit ID
    // GET /tag/:unitId — 按 unit ID 获取标签
    HttpApiEndpoint.get("getById", "/:unitId", {
      params: { unitId: Schema.String },
      success: TagUnitEntry,
      error: [TagNotFound, HttpApiError.InternalServerError],
    }),
    // POST /tag/ — create a new tag (requires login)
    // POST /tag/ — 创建新标签（需要登录）
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        slug: Schema.String,
        name: Schema.String,
        language: Schema.optional(Schema.String),
        description: Schema.optional(Schema.String),
      }),
      success: TagUnitEntry,
      error: [TagConflict, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // PUT /tag/:unitId — update a tag (admin)
    // PUT /tag/:unitId — 更新标签（管理员）
    HttpApiEndpoint.put("update", "/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        slug: Schema.optional(Schema.String),
        name: Schema.optional(Schema.String),
        language: Schema.optional(Schema.String),
        description: Schema.optional(Schema.String),
      }),
      success: TagUnitEntry,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // DELETE /tag/:unitId — delete a tag (admin)
    // DELETE /tag/:unitId — 删除标签（管理员）
    HttpApiEndpoint.delete("delete", "/:unitId", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // POST /tag/attach — admin: attach tag to unit
    // POST /tag/attach — 管理员：将标签附加到 unit
    HttpApiEndpoint.post("attach", "/attach", {
      payload: Schema.Struct({
        tagUnitId: Schema.String,
        unitId: Schema.String,
      }),
      success: HttpApiSchema.NoContent,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // POST /tag/detach — admin: detach tag from unit
    // POST /tag/detach — 管理员：从 unit 解除标签
    HttpApiEndpoint.post("detach", "/detach", {
      payload: Schema.Struct({
        tagUnitId: Schema.String,
        unitId: Schema.String,
      }),
      success: HttpApiSchema.NoContent,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // POST /tag/vote — cast a tag vote (requires login)
    // POST /tag/vote — 对标签投票（需要登录）
    HttpApiEndpoint.post("vote", "/vote", {
      payload: Schema.Struct({
        tagUnitId: Schema.String,
        unitId: Schema.String,
        value: Schema.Number,
      }),
      success: HttpApiSchema.NoContent,
      error: [TagForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // GET /tag/for-unit/:unitId — get tags for a specific unit
    // GET /tag/for-unit/:unitId — 获取特定 unit 的标签
    HttpApiEndpoint.get("forUnit", "/for-unit/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Struct({ tags: Schema.Array(UnitTagEntry) }),
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),
  )
  .prefix("/tag") {}

export class UnitTagGroup extends HttpApiGroup.make("unitTags")
  .add(
    // POST /unit-tag/ — creation-as-vote (login)
    // POST /unit-tag/ — 创建即投票（需登录）
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        unitId: Schema.String,
        tagUnitId: Schema.String,
      }),
      success: UnitTagEntry,
      error: [TagForbidden, HttpApiError.InternalServerError],
    }),
    // PATCH /unit-tag/:unitId/:tagUnitId — pin/position (admin or unit owner)
    // PATCH /unit-tag/:unitId/:tagUnitId — 置顶/排序（管理员或 unit 所有者）
    HttpApiEndpoint.patch("patch", "/:unitId/:tagUnitId", {
      params: { unitId: Schema.String, tagUnitId: Schema.String },
      payload: Schema.Struct({
        pinned: Schema.optional(Schema.Boolean),
        position: Schema.optional(Schema.String),
      }),
      success: UnitTagEntry,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }),
    // DELETE /unit-tag/:unitId/:tagUnitId — delete (admin or unit owner)
    // DELETE /unit-tag/:unitId/:tagUnitId — 删除（管理员或 unit 所有者）
    HttpApiEndpoint.delete("delete", "/:unitId/:tagUnitId", {
      params: { unitId: Schema.String, tagUnitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/unit-tag") {}

export class TagVoteGroup extends HttpApiGroup.make("tagVotes")
  .add(
    // POST /tag-vote/ — explicit vote action (login)
    // POST /tag-vote/ — 显式投票操作（需登录）
    HttpApiEndpoint.post("cast", "/", {
      payload: Schema.Struct({
        unitId: Schema.String,
        tagUnitId: Schema.String,
        value: Schema.Number,
      }),
      success: HttpApiSchema.NoContent,
      error: [TagForbidden, HttpApiError.InternalServerError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/tag-vote") {}

export class PolicyTagGroup extends HttpApiGroup.make("policyTags")
  .add(
    // GET /policy-tag/rules — list policy tag rules
    // GET /policy-tag/rules — 列出策略标签规则
    HttpApiEndpoint.get("listRules", "/rules", {
      query: {
        scopeKind: Schema.optional(Schema.String),
        realmUnitId: Schema.optional(Schema.String),
        state: Schema.optional(Schema.String),
        tagUnitId: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: PolicyTagRuleListResult,
      error: HttpApiError.InternalServerError,
    }),
    // POST /policy-tag/rules — create a policy tag rule
    // POST /policy-tag/rules — 创建策略标签规则
    HttpApiEndpoint.post("createRule", "/rules", {
      payload: Schema.Struct({
        scope: Schema.Struct({
          kind: Schema.String,
          realmUnitId: Schema.optional(Schema.String),
        }),
        tagUnitId: Schema.String,
        reason: Schema.optional(Schema.String),
      }),
      success: PolicyTagRuleEntry,
      error: [TagForbidden, TagConflict, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // PATCH /policy-tag/rules/:ruleId — update a policy tag rule
    // PATCH /policy-tag/rules/:ruleId — 更新策略标签规则
    HttpApiEndpoint.patch("updateRule", "/rules/:ruleId", {
      params: { ruleId: Schema.String },
      payload: Schema.Struct({
        state: Schema.optional(Schema.String),
        reason: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      success: PolicyTagRuleEntry,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // GET /policy-tag/applications — list policy tag applications
    // GET /policy-tag/applications — 列出策略标签应用
    HttpApiEndpoint.get("listApplications", "/applications", {
      query: {
        ruleId: Schema.optional(Schema.String),
        unitId: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: PolicyTagApplicationListResult,
      error: HttpApiError.InternalServerError,
    }),
    // POST /policy-tag/rules/:ruleId/applications — create/upsert application
    // POST /policy-tag/rules/:ruleId/applications — 创建/更新应用
    HttpApiEndpoint.post("createApplication", "/rules/:ruleId/applications", {
      params: { ruleId: Schema.String },
      payload: Schema.Struct({
        unitId: Schema.String,
        position: Schema.optional(Schema.String),
        metadata: Schema.optional(Schema.Unknown),
      }),
      success: PolicyTagApplicationEntry,
      error: [TagNotFound, TagForbidden, TagConflict, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // PATCH /policy-tag/rules/:ruleId/applications/:unitId — patch application
    // PATCH /policy-tag/rules/:ruleId/applications/:unitId — 修补应用
    HttpApiEndpoint.patch("patchApplication", "/rules/:ruleId/applications/:unitId", {
      params: { ruleId: Schema.String, unitId: Schema.String },
      payload: Schema.Struct({
        position: Schema.optional(Schema.NullOr(Schema.String)),
        metadata: Schema.optional(Schema.NullOr(Schema.Unknown)),
      }),
      success: PolicyTagApplicationEntry,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // DELETE /policy-tag/rules/:ruleId/applications/:unitId — delete application
    // DELETE /policy-tag/rules/:ruleId/applications/:unitId — 删除应用
    HttpApiEndpoint.delete("deleteApplication", "/rules/:ruleId/applications/:unitId", {
      params: { ruleId: Schema.String, unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [TagNotFound, TagForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/policy-tag") {}

export class UserTagApplicationGroup extends HttpApiGroup.make("userTagApplications")
  .add(
    // GET /user-tag-application/user/:userId/:unitId — list visible user tags for a unit
    // GET /user-tag-application/user/:userId/:unitId — 列出某个 unit 上对外可见的用户标签
    HttpApiEndpoint.get("listForUserUnit", "/user/:userId/:unitId", {
      params: { userId: Schema.String, unitId: Schema.String },
      success: Schema.Array(UserTagApplicationEntry),
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),
    // GET /user-tag-application/:unitId — list my user tags for a unit
    // GET /user-tag-application/:unitId — 列出我对某个 unit 的用户标签
    HttpApiEndpoint.get("listMine", "/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Array(UserTagApplicationEntry),
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),
    // PUT /user-tag-application/:unitId — replace my user tags for a unit
    // PUT /user-tag-application/:unitId — 替换我对某个 unit 的用户标签
    HttpApiEndpoint.put("set", "/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        tagUnitIds: Schema.Array(Schema.String),
      }),
      success: Schema.Array(UserTagApplicationEntry),
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),
    // PATCH /user-tag-application/:unitId/:tagUnitId/position — reorder one user tag application
    // PATCH /user-tag-application/:unitId/:tagUnitId/position — 重新排序一个用户标签应用
    HttpApiEndpoint.patch("reorder", "/:unitId/:tagUnitId/position", {
      params: { unitId: Schema.String, tagUnitId: Schema.String },
      payload: Schema.Struct({
        afterTagUnitId: Schema.optional(Schema.NullOr(Schema.String)),
        beforeTagUnitId: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      success: UserTagApplicationEntry,
      error: [TagNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
    // DELETE /user-tag-application/:unitId/:tagUnitId — delete one user tag application
    // DELETE /user-tag-application/:unitId/:tagUnitId — 删除一个用户标签应用
    HttpApiEndpoint.delete("delete", "/:unitId/:tagUnitId", {
      params: { unitId: Schema.String, tagUnitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),
  )
  .prefix("/user-tag-application") {}
