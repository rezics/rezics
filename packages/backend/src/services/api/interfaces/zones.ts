import { Schema } from "effect";
import { HttpApiEndpoint, HttpApiGroup } from "effect/unstable/httpapi";

import { AuthMiddleware, OptionalAuthMiddleware, Unauthorized } from "./middlewares/auth.ts";

// ---------------------------------------------------------------------------
// Response schemas — minimal placeholders; flesh out when implementing handlers
// 响应 schema —— 最小占位；实现 handler 时再细化
// ---------------------------------------------------------------------------

export class ZoneListResult extends Schema.Class<ZoneListResult>("ZoneListResult")({
  zones: Schema.Array(Schema.Any),
  total: Schema.Number,
}) {}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export class ZoneNotFound extends Schema.TaggedErrorClass<ZoneNotFound>()(
  "ZoneNotFound",
  {},
  { httpApiStatus: 404 },
) {}

export class ZoneForbidden extends Schema.TaggedErrorClass<ZoneForbidden>()(
  "ZoneForbidden",
  {},
  { httpApiStatus: 403 },
) {}

// ---------------------------------------------------------------------------
// Shared query schemas
// 共享查询参数 schema
// ---------------------------------------------------------------------------

const ZoneListQuery = Schema.Struct({
  view: Schema.optional(Schema.String),
  start: Schema.optional(Schema.NumberFromString),
  limit: Schema.optional(Schema.NumberFromString),
  languages: Schema.optional(Schema.String),
  appLocale: Schema.optional(Schema.String),
});

const ReadLanguageQuery = Schema.Struct({
  languages: Schema.optional(Schema.String),
  appLocale: Schema.optional(Schema.String),
});

// ---------------------------------------------------------------------------
// /zone — Zone CRUD + pages + themes
// /zone — 专区增删改查 + 页面 + 主题
// ---------------------------------------------------------------------------

export class ZonesGroup extends HttpApiGroup.make("zones")
  // --- Read endpoints ---
  // --- 读取端点 ---
  .add(
    // GET /zone/me — my zones
    // 我的专区
    HttpApiEndpoint.get("getMyZones", "/me", {
      query: ZoneListQuery,
      success: ZoneListResult,
      error: Unauthorized,
    }).middleware(AuthMiddleware),

    // GET /zone/user/:userId — zones for user
    // 用户的专区
    HttpApiEndpoint.get("getByUser", "/user/:userId", {
      params: { userId: Schema.String },
      query: ZoneListQuery,
      success: ZoneListResult,
    }).middleware(OptionalAuthMiddleware),

    // GET /zone/by-slug/:slug — zone by slug
    // 通过 slug 查询专区
    HttpApiEndpoint.get("getBySlug", "/by-slug/:slug", {
      params: { slug: Schema.String },
      query: ReadLanguageQuery,
      success: Schema.Any,
      error: ZoneNotFound,
    }),

    // GET /zone/:unitId/portal/:pageSlug — zone portal page
    // 专区入口页数据
    HttpApiEndpoint.get("getPortal", "/:unitId/portal/:pageSlug", {
      params: { unitId: Schema.String, pageSlug: Schema.String },
      query: ReadLanguageQuery,
      success: Schema.Any,
      error: ZoneNotFound,
    }),

    // GET /zone/:unitId/page/:pageId/section/:sectionId — zone section data
    // 专区栏目数据
    HttpApiEndpoint.get("getSectionData", "/:unitId/page/:pageId/section/:sectionId", {
      params: { unitId: Schema.String, pageId: Schema.String, sectionId: Schema.String },
      query: Schema.Struct({
        languages: Schema.optional(Schema.String),
        appLocale: Schema.optional(Schema.String),
        cursor: Schema.optional(Schema.String),
        dynamicTagUnitIds: Schema.optional(Schema.String),
      }),
      success: Schema.Any,
      error: ZoneNotFound,
    }),
  )
  // --- Write endpoints ---
  // --- 写入端点 ---
  .add(
    // POST /zone/ — create zone
    // 创建专区
    HttpApiEndpoint.post("create", "/", {
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, ZoneForbidden],
    }).middleware(AuthMiddleware),

    // PATCH /zone/:unitId — update zone
    // 更新专区
    HttpApiEndpoint.patch("update", "/:unitId", {
      params: { unitId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, ZoneForbidden, ZoneNotFound],
    }).middleware(AuthMiddleware),

    // PATCH /zone/:unitId/boundary — update zone boundary
    // 更新专区边界
    HttpApiEndpoint.patch("updateBoundary", "/:unitId/boundary", {
      params: { unitId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, ZoneForbidden, ZoneNotFound],
    }).middleware(AuthMiddleware),

    // PATCH /zone/:unitId/nav — update zone nav
    // 更新专区导航
    HttpApiEndpoint.patch("updateNav", "/:unitId/nav", {
      params: { unitId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, ZoneForbidden, ZoneNotFound],
    }).middleware(AuthMiddleware),

    // PATCH /zone/:unitId/theme — update zone theme
    // 更新专区主题
    HttpApiEndpoint.patch("updateTheme", "/:unitId/theme", {
      params: { unitId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, ZoneForbidden, ZoneNotFound],
    }).middleware(AuthMiddleware),

    // DELETE /zone/:unitId — delete zone
    // 删除专区
    HttpApiEndpoint.delete("remove", "/:unitId", {
      params: { unitId: Schema.String },
      success: Schema.Struct({ message: Schema.String }),
      error: [Unauthorized, ZoneForbidden, ZoneNotFound],
    }).middleware(AuthMiddleware),
  )
  // --- Pages ---
  // --- 页面管理 ---
  .add(
    // POST /zone/:unitId/pages — create page
    // 创建页面
    HttpApiEndpoint.post("createPage", "/:unitId/pages", {
      params: { unitId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, ZoneForbidden, ZoneNotFound],
    }).middleware(AuthMiddleware),

    // PATCH /zone/:unitId/pages/:pageId — update page
    // 更新页面
    HttpApiEndpoint.patch("updatePage", "/:unitId/pages/:pageId", {
      params: { unitId: Schema.String, pageId: Schema.String },
      payload: Schema.Any,
      success: Schema.Any,
      error: [Unauthorized, ZoneForbidden, ZoneNotFound],
    }).middleware(AuthMiddleware),

    // DELETE /zone/:unitId/pages/:pageId — delete page
    // 删除页面
    HttpApiEndpoint.delete("deletePage", "/:unitId/pages/:pageId", {
      params: { unitId: Schema.String, pageId: Schema.String },
      success: Schema.Any,
      error: [Unauthorized, ZoneForbidden, ZoneNotFound],
    }).middleware(AuthMiddleware),
  )
  .prefix("/zone") {}
