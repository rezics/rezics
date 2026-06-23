import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — minimal placeholders; flesh out when implementing handlers
// 响应 schema —— 最小占位；实现 handler 时再细化
// ---------------------------------------------------------------------------

export class UnitDTO extends Schema.Class<UnitDTO>("UnitDTO")({
  id: Schema.String,
  type: Schema.String,
  slug: Schema.NullOr(Schema.String),
  status: Schema.String,
  visibility: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
}) {}

export class UnitListResult extends Schema.Class<UnitListResult>("UnitListResult")({
  units: Schema.Array(UnitDTO),
  total: Schema.Number,
}) {}

export class TranslationDTO extends Schema.Class<TranslationDTO>("TranslationDTO")({
  unitId: Schema.String,
  language: Schema.String,
  title: Schema.NullOr(Schema.String),
  subtitle: Schema.NullOr(Schema.String),
  summary: Schema.NullOr(Schema.String),
}) {}

export class CollaboratorDTO extends Schema.Class<CollaboratorDTO>("CollaboratorDTO")({
  unitId: Schema.String,
  userId: Schema.String,
  role: Schema.String,
}) {}

export class FieldLockDTO extends Schema.Class<FieldLockDTO>("FieldLockDTO")({
  unitId: Schema.String,
  path: Schema.String,
  lockedBy: Schema.String,
}) {}

export class AliasDTO extends Schema.Class<AliasDTO>("AliasDTO")({
  id: Schema.String,
  unitId: Schema.String,
  value: Schema.String,
  normalizedValue: Schema.String,
  score: Schema.Number,
}) {}

export class AliasListResult extends Schema.Class<AliasListResult>("AliasListResult")({
  aliases: Schema.Array(AliasDTO),
  total: Schema.Number,
}) {}

export class ExternalLinkDTO extends Schema.Class<ExternalLinkDTO>("ExternalLinkDTO")({
  id: Schema.String,
  unitId: Schema.String,
  url: Schema.String,
  label: Schema.NullOr(Schema.String),
}) {}

export class ExternalLinkListResult extends Schema.Class<ExternalLinkListResult>(
  "ExternalLinkListResult",
)({
  links: Schema.Array(ExternalLinkDTO),
  total: Schema.Number,
}) {}

export class TranslationSourceDTO extends Schema.Class<TranslationSourceDTO>(
  "TranslationSourceDTO",
)({
  unitId: Schema.String,
  language: Schema.String,
  sourceUnitId: Schema.NullOr(Schema.String),
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class UnitNotFound extends Schema.TaggedErrorClass<UnitNotFound>()(
  "UnitNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class TranslationNotFound extends Schema.TaggedErrorClass<TranslationNotFound>()(
  "TranslationNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class AliasNotFound extends Schema.TaggedErrorClass<AliasNotFound>()(
  "AliasNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class ExternalLinkNotFound extends Schema.TaggedErrorClass<ExternalLinkNotFound>()(
  "ExternalLinkNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class UnitForbidden extends Schema.TaggedErrorClass<UnitForbidden>()(
  "UnitForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class InvalidSlug extends Schema.TaggedErrorClass<InvalidSlug>()(
  "InvalidSlug",
  {},
  { httpApiStatus: 400 },
) {}

// ---------------------------------------------------------------------------
// /unit — Unit CRUD + translations + collaborators + field locks + slug
// /unit-alias-record — alias CRUD
// /unit-alias-vote — alias voting
// /unit-external-link — external link CRUD
// ---------------------------------------------------------------------------

export class UnitsGroup extends HttpApiGroup.make("units")
  .add(
    // ── Unit CRUD ──────────────────────────────────────────────
    // ── Unit 增删改查 ──────────────────────────────────────────

    // GET /unit/:unitId — get a single unit
    // 获取单个 Unit
    HttpApiEndpoint.get("getUnit", "/unit/:unitId", {
      params: { unitId: Schema.String },
      success: UnitDTO,
      error: [UnitNotFound, HttpApiError.InternalServerError],
    }),

    // POST /unit — create unit
    // 创建 Unit
    HttpApiEndpoint.post("createUnit", "/unit", {
      payload: Schema.Struct({
        type: Schema.Literals([
          "BOOK", "GAME", "MEDIA", "POST", "TAG", "REALM", "SHELF",
          "IMAGE", "VIDEO", "QUOTE", "LINK", "ENTITY", "ZONE", "USER",
          "SCOPE", "SERIES", "LABEL", "POLL", "COMMENT",
        ]),
        defaultLanguage: Schema.optional(Schema.String),
        slug: Schema.optional(Schema.String),
      }),
      success: UnitDTO,
      error: HttpApiError.InternalServerError,
    }).middleware(AuthMiddleware),

    // PUT /unit/:unitId — update unit
    // 更新 Unit
    HttpApiEndpoint.put("updateUnit", "/unit/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        status: Schema.optional(Schema.String),
        visibility: Schema.optional(Schema.String),
        rating: Schema.optional(Schema.String),
        defaultLanguage: Schema.optional(Schema.String),
      }),
      success: UnitDTO,
      error: [UnitNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /unit/:unitId — delete unit
    // 删除 Unit
    HttpApiEndpoint.delete("deleteUnit", "/unit/:unitId", {
      params: { unitId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [UnitNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Unit list ──────────────────────────────────────────────

    // POST /unit/list — list units (body filters, admin-gated)
    // 列出 Unit（body 过滤，管理员限定）
    HttpApiEndpoint.post("listUnits", "/unit/list", {
      payload: Schema.Struct({
        type: Schema.optional(
          Schema.Literals([
            "BOOK", "GAME", "MEDIA", "POST", "TAG", "REALM", "SHELF",
            "IMAGE", "VIDEO", "QUOTE", "LINK", "ENTITY", "ZONE", "USER",
            "SCOPE", "SERIES", "LABEL", "POLL", "COMMENT",
          ]),
        ),
        status: Schema.optional(
          Schema.Literals(["DRAFT", "PUBLISHED", "ARCHIVED", "DELETED"]),
        ),
        visibility: Schema.optional(
          Schema.Literals(["PUBLIC", "UNLISTED", "PRIVATE"]),
        ),
        userId: Schema.optional(Schema.String),
        ids: Schema.optional(Schema.Array(Schema.String)),
        search: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.Number),
        offset: Schema.optional(Schema.Number),
        languages: Schema.optional(Schema.String),
        appLocale: Schema.optional(Schema.String),
      }),
      success: UnitListResult,
      error: [UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Slug ───────────────────────────────────────────────────

    // PUT /unit/:unitId/slug — set or update slug
    // 设置或更新 slug
    HttpApiEndpoint.put("setUnitSlug", "/unit/:unitId/slug", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({ slug: Schema.String }),
      success: UnitDTO,
      error: [UnitNotFound, UnitForbidden, InvalidSlug, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Translations ───────────────────────────────────────────

    // GET /unit/:unitId/translations/:language — get translation
    // 获取翻译
    HttpApiEndpoint.get("getTranslation", "/unit/:unitId/translations/:language", {
      params: { unitId: Schema.String, language: Schema.String },
      success: TranslationDTO,
      error: [TranslationNotFound, HttpApiError.InternalServerError],
    }),

    // PUT /unit/:unitId/translations/:language — upsert translation
    // 创建或更新翻译
    HttpApiEndpoint.put("upsertTranslation", "/unit/:unitId/translations/:language", {
      params: { unitId: Schema.String, language: Schema.String },
      payload: Schema.Struct({
        patch: Schema.Record(Schema.String, Schema.Unknown),
      }),
      success: TranslationDTO,
      error: [UnitNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /unit/:unitId/translations/:language — delete translation
    // 删除翻译
    HttpApiEndpoint.delete("deleteTranslation", "/unit/:unitId/translations/:language", {
      params: { unitId: Schema.String, language: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [TranslationNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Translation source ────────────────────────────────────

    // PATCH /unit/:unitId/translations/:lang/source — set or clear translation source
    // 设置或清除翻译来源
    HttpApiEndpoint.patch("setTranslationSource", "/unit/:unitId/translations/:lang/source", {
      params: { unitId: Schema.String, lang: Schema.String },
      payload: Schema.Struct({
        sourceUnitId: Schema.NullOr(Schema.String),
      }),
      success: TranslationSourceDTO,
      error: [UnitNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Collaborators ─────────────────────────────────────────

    // GET /unit/:unitId/collaborators — list collaborators
    // 列出协作者
    HttpApiEndpoint.get("listCollaborators", "/unit/:unitId/collaborators", {
      params: { unitId: Schema.String },
      success: Schema.Struct({ collaborators: Schema.Array(CollaboratorDTO) }),
      error: [UnitNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PUT /unit/:unitId/collaborators/:userId — add or update collaborator
    // 添加或更新协作者
    HttpApiEndpoint.put("upsertCollaborator", "/unit/:unitId/collaborators/:userId", {
      params: { unitId: Schema.String, userId: Schema.String },
      payload: Schema.Struct({ role: Schema.String }),
      success: CollaboratorDTO,
      error: [UnitNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /unit/:unitId/collaborators/:userId — remove collaborator
    // 移除协作者
    HttpApiEndpoint.delete("removeCollaborator", "/unit/:unitId/collaborators/:userId", {
      params: { unitId: Schema.String, userId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [UnitNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Field locks ───────────────────────────────────────────

    // GET /unit/:unitId/field-locks — list field locks
    // 列出字段锁
    HttpApiEndpoint.get("listFieldLocks", "/unit/:unitId/field-locks", {
      params: { unitId: Schema.String },
      success: Schema.Struct({ locks: Schema.Array(FieldLockDTO) }),
      error: [UnitNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PUT /unit/:unitId/field-locks/:path — create or update field lock
    // 创建或更新字段锁
    HttpApiEndpoint.put("upsertFieldLock", "/unit/:unitId/field-locks/:path", {
      params: { unitId: Schema.String, path: Schema.String },
      payload: Schema.Struct({
        reason: Schema.optional(Schema.String),
      }),
      success: FieldLockDTO,
      error: [UnitNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /unit/:unitId/field-locks/:path — remove field lock
    // 移除字段锁
    HttpApiEndpoint.delete("deleteFieldLock", "/unit/:unitId/field-locks/:path", {
      params: { unitId: Schema.String, path: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [UnitNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Unit aliases ──────────────────────────────────────────

    // GET /unit-alias-record — list aliases
    // 列出别名
    HttpApiEndpoint.get("listAliases", "/unit-alias-record", {
      query: {
        unitId: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: AliasListResult,
      error: HttpApiError.InternalServerError,
    }).middleware(OptionalAuthMiddleware),

    // POST /unit-alias-record — create alias
    // 创建别名
    HttpApiEndpoint.post("createAlias", "/unit-alias-record", {
      payload: Schema.Struct({
        unitId: Schema.String,
        value: Schema.String,
        language: Schema.optional(Schema.String),
      }),
      success: AliasDTO,
      error: [UnitNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PATCH /unit-alias-record/:aliasId — update alias
    // 更新别名
    HttpApiEndpoint.patch("updateAlias", "/unit-alias-record/:aliasId", {
      params: { aliasId: Schema.String },
      payload: Schema.Struct({
        value: Schema.optional(Schema.String),
        language: Schema.optional(Schema.String),
      }),
      success: AliasDTO,
      error: [AliasNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /unit-alias-record/:aliasId — delete alias
    // 删除别名
    HttpApiEndpoint.delete("deleteAlias", "/unit-alias-record/:aliasId", {
      params: { aliasId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [AliasNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Unit alias vote ───────────────────────────────────────

    // POST /unit-alias-vote — cast vote on alias
    // 对别名投票
    HttpApiEndpoint.post("castAliasVote", "/unit-alias-vote", {
      payload: Schema.Struct({
        aliasId: Schema.String,
        value: Schema.Number,
      }),
      success: AliasDTO,
      error: [AliasNotFound, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // ── Unit external links ───────────────────────────────────

    // GET /unit-external-link — list external links
    // 列出外部链接
    HttpApiEndpoint.get("listExternalLinks", "/unit-external-link", {
      query: {
        unitId: Schema.optional(Schema.String),
        sourceEntityUnitId: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: ExternalLinkListResult,
      error: HttpApiError.InternalServerError,
    }),

    // GET /unit-external-link/unit/:unitId/links — links for one unit
    // 获取单个 Unit 的外部链接
    HttpApiEndpoint.get("getExternalLinksForUnit", "/unit-external-link/unit/:unitId/links", {
      params: { unitId: Schema.String },
      query: {
        sourceEntityUnitId: Schema.optional(Schema.String),
      },
      success: Schema.Struct({ links: Schema.Array(ExternalLinkDTO) }),
      error: HttpApiError.InternalServerError,
    }),

    // POST /unit-external-link/units/links/batch — batch links for multiple units
    // 批量获取多个 Unit 的外部链接
    HttpApiEndpoint.post("batchExternalLinks", "/unit-external-link/units/links/batch", {
      payload: Schema.Struct({
        unitIds: Schema.Array(Schema.String),
      }),
      success: Schema.Record(Schema.String, Schema.Array(ExternalLinkDTO)),
      error: HttpApiError.InternalServerError,
    }),

    // POST /unit-external-link — create external link
    // 创建外部链接
    HttpApiEndpoint.post("createExternalLink", "/unit-external-link", {
      payload: Schema.Struct({
        unitId: Schema.String,
        url: Schema.String,
        label: Schema.optional(Schema.NullOr(Schema.String)),
        sourceEntityUnitId: Schema.optional(Schema.String),
      }),
      success: ExternalLinkDTO,
      error: [UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // PATCH /unit-external-link/:id — update external link
    // 更新外部链接
    HttpApiEndpoint.patch("updateExternalLink", "/unit-external-link/:id", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        url: Schema.optional(Schema.String),
        label: Schema.optional(Schema.NullOr(Schema.String)),
      }),
      success: ExternalLinkDTO,
      error: [ExternalLinkNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),

    // DELETE /unit-external-link/:id — delete external link
    // 删除外部链接
    HttpApiEndpoint.delete("deleteExternalLink", "/unit-external-link/:id", {
      params: { id: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [ExternalLinkNotFound, UnitForbidden, HttpApiError.InternalServerError],
    }).middleware(AuthMiddleware),
  ) {}
