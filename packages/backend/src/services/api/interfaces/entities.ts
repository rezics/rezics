import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware, Unauthorized } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Shared sub-schemas / 共享子 schema
// ---------------------------------------------------------------------------

/** Translation entry for entity create/update payloads. / 实体创建/更新载荷的翻译条目。 */
const TranslationInput = Schema.Struct({
  language: Schema.String,
  title: Schema.optional(Schema.String),
  subtitle: Schema.optional(Schema.String),
  summary: Schema.optional(Schema.String),
  description: Schema.optional(Schema.Unknown),
});

/** Single translation DTO in entity responses. / 实体响应中的单条翻译 DTO。 */
const TranslationDTO = Schema.Struct({
  unitId: Schema.String,
  language: Schema.String,
  title: Schema.NullOr(Schema.String),
  subtitle: Schema.NullOr(Schema.String),
  summary: Schema.NullOr(Schema.String),
  description: Schema.NullOr(Schema.Unknown),
  extra: Schema.NullOr(Schema.Unknown),
  sourceUnitId: Schema.NullOr(Schema.String),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

/** Entity DTO returned from get/create/update endpoints. / 由 get/create/update 端点返回的实体 DTO。 */
const EntityDTO = Schema.Struct({
  unitId: Schema.String,
  kind: Schema.NullOr(Schema.String),
  avatar: Schema.NullOr(Schema.String),
  verified: Schema.Boolean,
  eligibleCreditRoles: Schema.Array(Schema.String),
  eligibleSubjectRoles: Schema.Array(Schema.String),
  slug: Schema.NullOr(Schema.String),
  ownerUnitId: Schema.NullOr(Schema.String),
  translations: Schema.Array(TranslationDTO),
  createdAt: Schema.String,
  updatedAt: Schema.String,
});

/** Embedded entity inside attribution DTOs. / 嵌入归属 DTO 内的实体。 */
const EmbeddedEntityDTO = Schema.NullOr(Schema.Struct({
  unitId: Schema.String,
  kind: Schema.NullOr(Schema.String),
  avatar: Schema.NullOr(Schema.String),
  verified: Schema.Boolean,
  eligibleCreditRoles: Schema.Array(Schema.String),
  eligibleSubjectRoles: Schema.Array(Schema.String),
  slug: Schema.NullOr(Schema.String),
  ownerUnitId: Schema.NullOr(Schema.String),
  translations: Schema.Array(TranslationDTO),
  createdAt: Schema.String,
  updatedAt: Schema.String,
}));

/** Credit attribution DTO with hydrated entity. / 包含注水实体的创作归属 DTO。 */
const CreditAttributionDTO = Schema.Struct({
  unitId: Schema.String,
  entityId: Schema.String,
  role: Schema.String,
  position: Schema.String,
  entity: EmbeddedEntityDTO,
});

/** Subject attribution DTO with hydrated entity. / 包含注水实体的主题归属 DTO。 */
const SubjectAttributionDTO = Schema.Struct({
  unitId: Schema.String,
  entityId: Schema.String,
  role: Schema.String,
  position: Schema.String,
  weight: Schema.NullOr(Schema.Number),
  entity: EmbeddedEntityDTO,
});

// ---------------------------------------------------------------------------
// Response schemas / 响应 schema
// ---------------------------------------------------------------------------

export class EntityListResult extends Schema.Class<EntityListResult>("EntityListResult")({
  entities: Schema.Array(EntityDTO),
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
      success: EntityDTO,
      error: [EntityNotFound, HttpApiError.InternalServerError],
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
      error: HttpApiError.InternalServerError,
    }),

    // GET /entity/:unitId — look up entity by unitId
    // 通过 unitId 查找实体
    HttpApiEndpoint.get("getById", "/:unitId", {
      params: { unitId: Schema.String },
      success: EntityDTO,
      error: [EntityNotFound, HttpApiError.InternalServerError],
    }),

    // POST /entity/ — create entity
    // 创建实体
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Struct({
        slug: Schema.optional(Schema.String),
        kind: Schema.optional(Schema.String),
        avatar: Schema.optional(Schema.String),
        verified: Schema.optional(Schema.Boolean),
        eligibleCreditRoles: Schema.optional(Schema.Array(Schema.String)),
        eligibleSubjectRoles: Schema.optional(Schema.Array(Schema.String)),
        translations: Schema.optional(Schema.Array(TranslationInput)),
      }),
      success: EntityDTO,
      error: [Unauthorized, EntityNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PATCH /entity/:unitId — update entity
    // 更新实体
    HttpApiEndpoint.patch("update", "/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        slug: Schema.optional(Schema.NullOr(Schema.String)),
        kind: Schema.optional(Schema.NullOr(Schema.String)),
        avatar: Schema.optional(Schema.NullOr(Schema.String)),
        verified: Schema.optional(Schema.Boolean),
        eligibleCreditRoles: Schema.optional(Schema.Array(Schema.String)),
        eligibleSubjectRoles: Schema.optional(Schema.Array(Schema.String)),
        translations: Schema.optional(Schema.Array(TranslationInput)),
      }),
      success: EntityDTO,
      error: [Unauthorized, EntityNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /entity/:unitId — delete entity (admin only)
    // 删除实体（仅管理员）
    HttpApiEndpoint.delete("remove", "/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Struct({ message: Schema.String }),
      error: [Unauthorized, EntityForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/entity") {}

// ---------------------------------------------------------------------------
// Batch attribution operation sub-schemas / 批量归属操作子 schema
// ---------------------------------------------------------------------------

const BatchEntry = Schema.Struct({
  entityId: Schema.String,
  position: Schema.optional(Schema.String),
  weight: Schema.optional(Schema.Number),
});

const BatchOp = Schema.Struct({
  op: Schema.String,
  role: Schema.String,
  entries: Schema.optional(Schema.Array(BatchEntry)),
});

/** Batch result credit row. / 批量结果创作归属行。 */
const BatchCreditRow = Schema.Struct({
  unitId: Schema.String,
  entityId: Schema.String,
  role: Schema.String,
  position: Schema.String,
});

/** Batch result subject row. / 批量结果主题归属行。 */
const BatchSubjectRow = Schema.Struct({
  unitId: Schema.String,
  entityId: Schema.String,
  role: Schema.String,
  position: Schema.String,
  weight: Schema.NullOr(Schema.Number),
});

const BatchUpdateResult = Schema.Struct({
  unitId: Schema.String,
  changed: Schema.Boolean,
  credits: Schema.Array(BatchCreditRow),
  subjects: Schema.Array(BatchSubjectRow),
});

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
      payload: Schema.Struct({
        ops: Schema.optional(Schema.Array(BatchOp)),
      }),
      success: BatchUpdateResult,
      error: [Unauthorized, HttpApiError.InternalServerError],
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
      payload: Schema.Struct({
        unitId: Schema.String,
        entityId: Schema.String,
        role: Schema.String,
        position: Schema.optional(Schema.String),
      }),
      success: CreditAttributionDTO,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // GET /credit-attribution/by-unit/:unitId — list by unit
    // 列出某 unit 的创作归属
    HttpApiEndpoint.get("listByUnit", "/by-unit/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Array(CreditAttributionDTO),
      error: HttpApiError.InternalServerError,
    }),

    // POST /credit-attribution/evidence — create evidence (admin)
    // 创建证据（管理员）
    HttpApiEndpoint.post("createEvidence", "/evidence", {
      payload: Schema.Struct({
        unitId: Schema.String,
        entityId: Schema.String,
        role: Schema.String,
        sourceExternalLinkId: Schema.String,
        claimPath: Schema.optional(Schema.String),
        observedUrl: Schema.optional(Schema.String),
        observedAt: Schema.optional(Schema.String),
        confidence: Schema.optional(Schema.Number),
      }),
      success: CreditAttributionDTO,
      error: [Unauthorized, EntityForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /credit-attribution/:unitId/:entityId/:role — unlink
    // 解除关联
    HttpApiEndpoint.delete("unlink", "/:unitId/:entityId/:role", {
      params: { unitId: Schema.String, entityId: Schema.String, role: Schema.String },
      success: Schema.Struct({ message: Schema.String }),
      error: [Unauthorized, HttpApiError.InternalServerError],
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
      payload: Schema.Struct({
        unitId: Schema.String,
        entityId: Schema.String,
        role: Schema.String,
        position: Schema.optional(Schema.String),
        weight: Schema.optional(Schema.NullOr(Schema.Number)),
      }),
      success: SubjectAttributionDTO,
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // GET /subject-attribution/by-unit/:unitId — list by unit
    // 列出某 unit 的主题归属
    HttpApiEndpoint.get("listByUnit", "/by-unit/:unitId", {
      params: { unitId: Schema.String },
      query: {
        role: Schema.optional(Schema.String),
      },
      success: Schema.Array(SubjectAttributionDTO),
      error: HttpApiError.InternalServerError,
    }),

    // GET /subject-attribution/by-subject/:entityId — list by subject entity
    // 列出某主题实体的归属
    HttpApiEndpoint.get("listBySubject", "/by-subject/:entityId", {
      params: { entityId: Schema.String },
      query: {
        role: Schema.optional(Schema.String),
      },
      success: Schema.Array(SubjectAttributionDTO),
      error: HttpApiError.InternalServerError,
    }),

    // DELETE /subject-attribution/:unitId/:entityId/:role — unlink
    // 解除关联
    HttpApiEndpoint.delete("unlink", "/:unitId/:entityId/:role", {
      params: { unitId: Schema.String, entityId: Schema.String, role: Schema.String },
      success: Schema.Struct({ message: Schema.String }),
      error: [Unauthorized, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  )
  .prefix("/subject-attribution") {}
