import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiError, HttpApiGroup, HttpApiSchema } from "effect/unstable/httpapi";

import { AuthMiddleware } from "./middlewares/auth.ts";

// -- Response schemas 响应模型 --

export class AuthUserSummary extends Schema.Class<AuthUserSummary>("AuthUserSummary")({
  id: Schema.String,
  email: Schema.String,
  name: Schema.String,
  createdAt: Schema.DateFromString,
  sessionCount: Schema.Number,
}) {}

export class AuthUserSession extends Schema.Class<AuthUserSession>("AuthUserSession")({
  id: Schema.String,
  userId: Schema.String,
  ipAddress: Schema.NullOr(Schema.String),
  userAgent: Schema.NullOr(Schema.String),
  createdAt: Schema.DateFromString,
  expiresAt: Schema.DateFromString,
}) {}

export class RepairJob extends Schema.Class<RepairJob>("RepairJob")({
  id: Schema.String,
  type: Schema.String,
  status: Schema.String,
  result: Schema.optional(Schema.Unknown),
  createdAt: Schema.DateFromString,
  updatedAt: Schema.DateFromString,
}) {}

export class AdminStats extends Schema.Class<AdminStats>("AdminStats")({
  users: Schema.Number,
  units: Schema.Number,
  realms: Schema.Number,
}) {}

export class DashboardSummary extends Schema.Class<DashboardSummary>("DashboardSummary")({
  stats: AdminStats,
  recentActivity: Schema.Array(Schema.Unknown),
}) {}

export class JwtServiceEntry extends Schema.Class<JwtServiceEntry>("JwtServiceEntry")({
  id: Schema.String,
  name: Schema.String,
  active: Schema.Boolean,
  createdAt: Schema.DateFromString,
}) {}

export class DiagnosticResult extends Schema.Class<DiagnosticResult>("DiagnosticResult")({
  status: Schema.String,
  checks: Schema.Record(Schema.String, Schema.Unknown),
}) {}

export class EchoKVEntry extends Schema.Class<EchoKVEntry>("EchoKVEntry")({
  key: Schema.String,
  value: Schema.Unknown,
}) {}

export class SlugResolution extends Schema.Class<SlugResolution>("SlugResolution")({
  slug: Schema.String,
  unitId: Schema.String,
  kind: Schema.String,
}) {}

export class DispatchResult extends Schema.Class<DispatchResult>("DispatchResult")({
  id: Schema.String,
  status: Schema.String,
  result: Schema.optional(Schema.Unknown),
}) {}

export class LabelEntry extends Schema.Class<LabelEntry>("LabelEntry")({
  id: Schema.String,
  name: Schema.String,
  color: Schema.optional(Schema.String),
}) {}

export class LinkEntry extends Schema.Class<LinkEntry>("LinkEntry")({
  id: Schema.String,
  unitId: Schema.String,
  url: Schema.String,
  title: Schema.optional(Schema.String),
  kind: Schema.optional(Schema.String),
}) {}

export class TokenEntry extends Schema.Class<TokenEntry>("TokenEntry")({
  id: Schema.String,
  name: Schema.String,
  token: Schema.optional(Schema.String),
  permissions: Schema.Array(Schema.String),
  createdAt: Schema.DateFromString,
  expiresAt: Schema.NullOr(Schema.DateFromString),
}) {}

export class TokenBookEntry extends Schema.Class<TokenBookEntry>("TokenBookEntry")({
  id: Schema.String,
  title: Schema.String,
  status: Schema.String,
}) {}

export class TokenUserEntry extends Schema.Class<TokenUserEntry>("TokenUserEntry")({
  id: Schema.String,
  name: Schema.String,
  email: Schema.String,
}) {}

export class GameSystemRequirement extends Schema.Class<GameSystemRequirement>("GameSystemRequirement")({
  id: Schema.String,
  unitId: Schema.String,
  platform: Schema.String,
  requirements: Schema.Unknown,
}) {}

// -- Errors 错误 --

export class AdminForbidden extends Schema.TaggedErrorClass<AdminForbidden>()(
  "AdminForbidden",
  {},
  { httpApiStatus: 403 },
) {}

export class AdminNotFound extends Schema.TaggedErrorClass<AdminNotFound>()(
  "AdminNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class AdminConflict extends Schema.TaggedErrorClass<AdminConflict>()(
  "AdminConflict",
  {},
  { httpApiStatus: 409 },
) {}

// -- Group 接口组 --

export class AdminGroup extends HttpApiGroup.make("admin")
  .add(
    // -- Account operations 帐号操作 --
    HttpApiEndpoint.post("authUsersSummary", "/auth-users/summary", {
      payload: Schema.Struct({
        userIds: Schema.optional(Schema.Array(Schema.String)),
        limit: Schema.optional(Schema.Int),
        offset: Schema.optional(Schema.Int),
      }),
      success: Schema.Array(AuthUserSummary),
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("authUsersSessions", "/auth-users/sessions", {
      payload: Schema.Struct({
        userId: Schema.String,
      }),
      success: Schema.Array(AuthUserSession),
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("authUsersRevoke", "/auth-users/revoke", {
      payload: Schema.Struct({
        userId: Schema.String,
        sessionId: Schema.optional(Schema.String),
      }),
      success: HttpApiSchema.NoContent,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("authUsersImpersonate", "/auth-users/impersonate", {
      payload: Schema.Struct({
        userId: Schema.String,
      }),
      success: Schema.Struct({ token: Schema.String }),
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- Repair jobs 修复任务 --
    HttpApiEndpoint.post("repairDryRun", "/repair/dry-run", {
      payload: Schema.Struct({
        type: Schema.String,
        params: Schema.optional(Schema.Unknown),
      }),
      success: RepairJob,
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("repairCreate", "/repair/create", {
      payload: Schema.Struct({
        type: Schema.String,
        params: Schema.optional(Schema.Unknown),
      }),
      success: RepairJob,
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("repairRetry", "/repair/retry", {
      payload: Schema.Struct({
        jobId: Schema.String,
      }),
      success: RepairJob,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("repairCancel", "/repair/cancel", {
      payload: Schema.Struct({
        jobId: Schema.String,
      }),
      success: RepairJob,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- Stats 统计 --
    HttpApiEndpoint.get("stats", "/stats", {
      success: AdminStats,
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.get("dashboardSummary", "/dashboard-summary", {
      success: DashboardSummary,
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),

    // -- JWT services JWT 服务 --
    HttpApiEndpoint.get("listJwtServices", "/jwt-services", {
      success: Schema.Array(JwtServiceEntry),
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("createJwtService", "/jwt-services", {
      payload: Schema.Struct({
        name: Schema.String,
      }),
      success: JwtServiceEntry,
      error: [AdminForbidden, AdminConflict, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.patch("updateJwtService", "/jwt-services/:id", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        name: Schema.optional(Schema.String),
      }),
      success: JwtServiceEntry,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("activateJwtService", "/jwt-services/:id/activate", {
      params: { id: Schema.String },
      success: JwtServiceEntry,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("deactivateJwtService", "/jwt-services/:id/deactivate", {
      params: { id: Schema.String },
      success: JwtServiceEntry,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("rotateJwtService", "/jwt-services/:id/rotate", {
      params: { id: Schema.String },
      success: JwtServiceEntry,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- History outbox 历史发件箱 --
    HttpApiEndpoint.post("historyRetryFailed", "/history/retry-failed", {
      success: Schema.Struct({ retried: Schema.Number }),
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),

    // -- Diagnostic 诊断 --
    HttpApiEndpoint.get("diagnosticSystem", "/diagnostic/system", {
      success: DiagnosticResult,
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),

    // -- EchoKV --
    HttpApiEndpoint.get("echokvGet", "/echokv/:key", {
      params: { key: Schema.String },
      success: EchoKVEntry,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.put("echokvPut", "/echokv/:key", {
      params: { key: Schema.String },
      payload: Schema.Struct({
        value: Schema.Unknown,
      }),
      success: EchoKVEntry,
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),

    // -- Slug resolution Slug 解析 --
    HttpApiEndpoint.post("slugResolve", "/slug/resolve", {
      payload: Schema.Struct({
        slug: Schema.String,
        kind: Schema.optional(
          Schema.Literals([
            "BOOK", "GAME", "MEDIA", "POST", "TAG", "REALM", "SHELF",
            "IMAGE", "VIDEO", "QUOTE", "LINK", "ENTITY", "ZONE", "USER",
            "SCOPE", "SERIES", "LABEL", "POLL", "COMMENT",
          ]),
        ),
      }),
      success: SlugResolution,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- Dispatch 调度 (token auth) --
    HttpApiEndpoint.post("dispatchResults", "/dispatch/results", {
      payload: Schema.Struct({
        results: Schema.Array(
          Schema.Struct({
            id: Schema.optional(Schema.String),
            status: Schema.optional(Schema.String),
            result: Schema.optional(Schema.Unknown),
          }),
        ),
      }),
      success: Schema.Array(DispatchResult),
      error: HttpApiError.InternalServerError,
    }),

    // -- DM 私信 --
    HttpApiEndpoint.post("dmSend", "/dm/send", {
      payload: Schema.Struct({
        recipientId: Schema.String,
        subject: Schema.optional(Schema.String),
        body: Schema.String,
      }),
      success: Schema.Struct({ id: Schema.String }),
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- Label 标签 --
    HttpApiEndpoint.get("labelList", "/label/list", {
      query: {
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(LabelEntry),
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("labelCreate", "/label", {
      payload: Schema.Struct({
        name: Schema.String,
        color: Schema.optional(Schema.String),
      }),
      success: LabelEntry,
      error: [AdminForbidden, AdminConflict, HttpApiError.InternalServerError],
    }),

    // -- Link 链接 --
    HttpApiEndpoint.post("linkCreate", "/link/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Struct({
        url: Schema.String,
        title: Schema.optional(Schema.String),
        kind: Schema.optional(Schema.String),
      }),
      success: LinkEntry,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.get("linkList", "/link/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Array(LinkEntry),
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.put("linkUpdate", "/link/:unitId/:linkId", {
      params: { unitId: Schema.String, linkId: Schema.String },
      payload: Schema.Struct({
        url: Schema.optional(Schema.String),
        title: Schema.optional(Schema.String),
        kind: Schema.optional(Schema.String),
      }),
      success: LinkEntry,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.delete("linkDelete", "/link/:unitId/:linkId", {
      params: { unitId: Schema.String, linkId: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- Token management 令牌管理 --
    HttpApiEndpoint.get("tokenList", "/token/tokens", {
      query: {
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(TokenEntry),
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("tokenCreate", "/token/tokens", {
      payload: Schema.Struct({
        name: Schema.String,
        permissions: Schema.Array(Schema.String),
        expiresAt: Schema.optional(Schema.DateFromString),
      }),
      success: TokenEntry,
      error: [AdminForbidden, AdminConflict, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.put("tokenUpdate", "/token/tokens/:id", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        name: Schema.optional(Schema.String),
        permissions: Schema.optional(Schema.Array(Schema.String)),
      }),
      success: TokenEntry,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.delete("tokenDelete", "/token/tokens/:id", {
      params: { id: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- Token-authenticated book access 令牌鉴权图书访问 --
    HttpApiEndpoint.get("tokenBooksList", "/token/books", {
      query: {
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(TokenBookEntry),
      error: HttpApiError.InternalServerError,
    }),
    HttpApiEndpoint.post("tokenBooksCreate", "/token/books", {
      payload: Schema.Struct({
        title: Schema.String,
        status: Schema.optional(
          Schema.Literals(["DRAFT", "PUBLISHED", "ARCHIVED", "DELETED"]),
        ),
      }),
      success: TokenBookEntry,
      error: HttpApiError.InternalServerError,
    }),
    HttpApiEndpoint.put("tokenBooksUpdate", "/token/books/:id", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        title: Schema.optional(Schema.String),
        status: Schema.optional(
          Schema.Literals(["DRAFT", "PUBLISHED", "ARCHIVED", "DELETED"]),
        ),
      }),
      success: TokenBookEntry,
      error: [AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- Token-authenticated user access 令牌鉴权用户访问 --
    HttpApiEndpoint.get("tokenUsersList", "/token/users", {
      query: {
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(TokenUserEntry),
      error: HttpApiError.InternalServerError,
    }),
    HttpApiEndpoint.post("tokenUsersCreate", "/token/users", {
      payload: Schema.Struct({
        name: Schema.String,
        email: Schema.String,
      }),
      success: TokenUserEntry,
      error: HttpApiError.InternalServerError,
    }),
    HttpApiEndpoint.put("tokenUsersUpdate", "/token/users/:id", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        name: Schema.optional(Schema.String),
        email: Schema.optional(Schema.String),
      }),
      success: TokenUserEntry,
      error: [AdminNotFound, HttpApiError.InternalServerError],
    }),

    // -- Game system requirements 游戏系统需求 --
    HttpApiEndpoint.get("gameSystemRequirementList", "/game-system-requirement", {
      query: {
        unitId: Schema.optional(Schema.String),
        limit: Schema.optional(Schema.NumberFromString),
        offset: Schema.optional(Schema.NumberFromString),
      },
      success: Schema.Array(GameSystemRequirement),
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.post("gameSystemRequirementCreate", "/game-system-requirement", {
      payload: Schema.Struct({
        unitId: Schema.String,
        platform: Schema.String,
        requirements: Schema.Record(Schema.String, Schema.Unknown),
      }),
      success: GameSystemRequirement,
      error: [AdminForbidden, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.patch("gameSystemRequirementUpdate", "/game-system-requirement/:id", {
      params: { id: Schema.String },
      payload: Schema.Struct({
        platform: Schema.optional(Schema.String),
        requirements: Schema.optional(Schema.Unknown),
      }),
      success: GameSystemRequirement,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
    HttpApiEndpoint.delete("gameSystemRequirementDelete", "/game-system-requirement/:id", {
      params: { id: Schema.String },
      success: HttpApiSchema.NoContent,
      error: [AdminForbidden, AdminNotFound, HttpApiError.InternalServerError],
    }),
  )
  .middleware(AuthMiddleware)
  .prefix("/admin") {}
