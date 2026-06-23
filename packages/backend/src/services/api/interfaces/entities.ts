import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware, Unauthorized } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — minimal placeholders; flesh out when implementing handlers
// 响应 schema —— 最小占位；实现 handler 时再细化
// ---------------------------------------------------------------------------

export class EntityListResult extends Schema.Class<EntityListResult>("EntityListResult")({
  entities: Schema.Array(Schema.Any),
  total: Schema.Number,
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class EntityNotFound extends Schema.TaggedErrorClass<EntityNotFound>()(
  "EntityNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class EntityForbidden extends Schema.TaggedErrorClass<EntityForbidden>()(
  "EntityForbidden",
  {},
  { httpApiStatus: 403 },
) {}

// ---------------------------------------------------------------------------
// /entity — Entity CRUD
// /entity — 实体增删改查
// ---------------------------------------------------------------------------

export class EntitiesGroup extends HttpApiGroup.make("entities")
  .add(
    // GET /entity/by-slug/:slug — look up entity by slug
    // 通过 slug 查找实体
    HttpApiEndpoint.get("getBySlug", "/by-slug/:slug", {
      params: { slug: Schema.String },
      success: Schema.Any,
      error: EntityNotFound,
    }),

    // GET /entity/ — list entities with filters
    // 列出实体（含过滤）
    HttpApiEndpoint.get("list", "/", {
      query: {
        kind: Schema.optional(Schema.String),
        verified: Schema.optional(Schema.String),
        ownerUnitId: Schema.optional(Schema.String),
        q: Schema.optional(Schema.String),
        ids: Schema.optional(Schema.String),
        offset: Schema.optional(Schema.NumberFromString),
        limit: Schema.optional(Schema.NumberFromString),
      },
      success: EntityListResult,
    }),

    // GET /entity/:unitId — look up entity by unitId
    // 通过 unitId 查找实体
    HttpApiEndpoint.get("getById", "/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Any,
      error: EntityNotFound,
    }),

    // POST /entity/ — create entity
    // 创建实体
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Any,
      success: Schema.Any,
      error: Unauthorized,
    }).middleware(AuthMiddleware),

    // PATCH /entity/:unitId — update entity
    // 更新实体
    HttpApiEndpoint.patch("update", "/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, EntityNotFound],
    }).middleware(AuthMiddleware),

    // DELETE /entity/:unitId — delete entity (admin only)
    // 删除实体（仅管理员）
    HttpApiEndpoint.delete("remove", "/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Struct({ message: Schema.String }),
      error: [Unauthorized, EntityForbidden],
    }).middleware(AuthMiddleware),
  )
  .prefix("/entity") {}

// ---------------------------------------------------------------------------
// /unit — Entity attribution batch
// /unit — 实体归属批量操作
// ---------------------------------------------------------------------------

export class EntityAttributionGroup extends HttpApiGroup.make("entityAttribution")
  .add(
    // PATCH /unit/:unitId/entity-attributions/batch — batch update attributions
    // 批量更新实体归属
    HttpApiEndpoint.patch("batchUpdate", "/:unitId/entity-attributions/batch", {
      params: { unitId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: Unauthorized,
    }).middleware(AuthMiddleware),
  )
  .prefix("/unit") {}

// ---------------------------------------------------------------------------
// /credit-attribution — Credit attribution CRUD
// /credit-attribution — 创作归属增删改查
// ---------------------------------------------------------------------------

export class CreditAttributionGroup extends HttpApiGroup.make("creditAttribution")
  .add(
    // POST /credit-attribution/ — link credit attribution
    // 创建创作归属关联
    HttpApiEndpoint.post("link", "/", {
      payload: Schema.Any,
      success: Schema.Any,
      error: Unauthorized,
    }).middleware(AuthMiddleware),

    // GET /credit-attribution/by-unit/:unitId — list by unit
    // 列出某 unit 的创作归属
    HttpApiEndpoint.get("listByUnit", "/by-unit/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Array(Schema.Any),
    }),

    // POST /credit-attribution/evidence — create evidence (admin)
    // 创建证据（管理员）
    HttpApiEndpoint.post("createEvidence", "/evidence", {
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, EntityForbidden],
    }).middleware(AuthMiddleware),

    // DELETE /credit-attribution/:unitId/:entityId/:role — unlink
    // 解除关联
    HttpApiEndpoint.delete("unlink", "/:unitId/:entityId/:role", {
      params: { unitId: Schema.String, entityId: Schema.String, role: Schema.String },
      success: Schema.Struct({ message: Schema.String }),
      error: Unauthorized,
    }).middleware(AuthMiddleware),
  )
  .prefix("/credit-attribution") {}

// ---------------------------------------------------------------------------
// /subject-attribution — Subject attribution CRUD
// /subject-attribution — 主题归属增删改查
// ---------------------------------------------------------------------------

export class SubjectAttributionGroup extends HttpApiGroup.make("subjectAttribution")
  .add(
    // POST /subject-attribution/ — link subject attribution
    // 创建主题归属关联
    HttpApiEndpoint.post("link", "/", {
      payload: Schema.Any,
      success: Schema.Any,
      error: Unauthorized,
    }).middleware(AuthMiddleware),

    // GET /subject-attribution/by-unit/:unitId — list by unit
    // 列出某 unit 的主题归属
    HttpApiEndpoint.get("listByUnit", "/by-unit/:unitId", {
      params: { unitId: Schema.String },
      query: {
        role: Schema.optional(Schema.String),
      },
      success: Schema.Array(Schema.Any),
    }),

    // GET /subject-attribution/by-subject/:entityId — list by subject entity
    // 列出某主题实体的归属
    HttpApiEndpoint.get("listBySubject", "/by-subject/:entityId", {
      params: { entityId: Schema.String },
      query: {
        role: Schema.optional(Schema.String),
      },
      success: Schema.Array(Schema.Any),
    }),

    // DELETE /subject-attribution/:unitId/:entityId/:role — unlink
    // 解除关联
    HttpApiEndpoint.delete("unlink", "/:unitId/:entityId/:role", {
      params: { unitId: Schema.String, entityId: Schema.String, role: Schema.String },
      success: Schema.Struct({ message: Schema.String }),
      error: Unauthorized,
    }).middleware(AuthMiddleware),
  )
  .prefix("/subject-attribution") {}
