import { Value } from "@sinclair/typebox/value";
import { t } from "elysia";

// ============================================================
// SHORT-PREFIX SLUG ROUTES — accept only slug-shaped values
// 短前缀 slug 路由 —— 仅接受形如 slug 的值
// ============================================================

/**
 * Canonical public user-space root: `/u/:userSlug`.
 * 规范的公共用户空间根路径：`/u/:userSlug`。
 *
 * This root is not the profile surface. Profile is an explicit child route
 * (`/u/:userSlug/profile`) so the root can later render a themed public home
 * based on the user's display preference.
 * 该根路径不是个人资料页。个人资料是显式子路由
 * （`/u/:userSlug/profile`），这样根路径以后可以根据用户展示偏好渲染
 * 对外主题主页。
 *
 * Resolves `(slugScope = <user-scope-unit-id>, slug = :userSlug)` on `Unit`.
 * It NEVER resolves `Unit.id`; callers holding a unit id must use the
 * long-prefix route `/user/:unitId` or the generic `/unit/:unitId` fallback.
 * 在 `Unit` 上解析 `(slugScope = <user-scope-unit-id>, slug = :userSlug)`。
 * 它绝不解析 `Unit.id`；持有 unit id 的调用方必须使用长前缀路由
 * `/user/:unitId` 或通用兜底路由 `/unit/:unitId`。
 */
export const publicUserSlugRouteParamsSchema = t.Object({
  userSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/r/:realmSlug`.
 * 规范的公共浏览器路径：`/r/:realmSlug`。
 *
 * Resolves `(slugScope = <realm-scope-unit-id>, slug = :realmSlug)` on
 * `Unit`. It NEVER resolves `Unit.id`.
 * 在 `Unit` 上解析 `(slugScope = <realm-scope-unit-id>, slug = :realmSlug)`。
 * 它绝不解析 `Unit.id`。
 */
export const publicRealmSlugRouteParamsSchema = t.Object({
  realmSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/t/:tagSlug`.
 * 规范的公共浏览器路径：`/t/:tagSlug`。
 *
 * Resolves `(slugScope = <tag-scope-unit-id>, slug = :tagSlug)` on `Unit`.
 * It NEVER resolves `Unit.id`.
 * 在 `Unit` 上解析 `(slugScope = <tag-scope-unit-id>, slug = :tagSlug)`。
 * 它绝不解析 `Unit.id`。
 */
export const publicTagSlugRouteParamsSchema = t.Object({
  tagSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/z/:zoneSlug`.
 * 规范的公共浏览器路径：`/z/:zoneSlug`。
 *
 * Resolves `(slugScope = <zone-scope-unit-id>, slug = :zoneSlug)` on
 * `Unit`. It NEVER resolves `Unit.id`.
 * 在 `Unit` 上解析 `(slugScope = <zone-scope-unit-id>, slug = :zoneSlug)`。
 * 它绝不解析 `Unit.id`。
 */
export const publicZoneSlugRouteParamsSchema = t.Object({
  zoneSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/e/:entitySlug`.
 * 规范的公共浏览器路径：`/e/:entitySlug`。
 *
 * Resolves `(slugScope = <entity-scope-unit-id>, slug = :entitySlug)` on
 * `Unit`. Returns 404 for every input until `entity-slug-activation`
 * permits ENTITY slug writes. It NEVER resolves `Unit.id`.
 * 在 `Unit` 上解析 `(slugScope = <entity-scope-unit-id>, slug = :entitySlug)`。
 * 在 `entity-slug-activation` 允许写入 ENTITY slug 之前，对任何输入都返回
 * 404。它绝不解析 `Unit.id`。
 */
export const publicEntitySlugRouteParamsSchema = t.Object({
  entitySlug: t.String({ minLength: 1 }),
});

// ============================================================
// LONG-PREFIX UUID ROUTES — accept only UUID-shaped values
// 长前缀 UUID 路由 —— 仅接受形如 UUID 的值
// ============================================================

/**
 * Id-based public user-space fallback root: `/user/:unitId`.
 * 基于 id 的公共用户空间兜底根路径：`/user/:unitId`。
 *
 * This root intentionally does not imply a slug redirect. Profile is an
 * explicit child route (`/user/:unitId/profile`) so id links remain a stable
 * fallback for callers that do not hold a slug.
 * 该根路径有意不隐含 slug 跳转。个人资料是显式子路由
 * （`/user/:unitId/profile`），因此持有 id 的调用方可继续使用稳定兜底链接。
 *
 * Resolves only `Unit.id` where `type = USER`. Returns 404 for type
 * mismatch. It NEVER resolves a slug.
 * 仅解析 `type = USER` 的 `Unit.id`。类型不匹配时返回 404。它绝不解析 slug。
 */
export const publicUserUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/realm/:unitId`.
 * 规范的公共浏览器路径：`/realm/:unitId`。
 *
 * Resolves only `Unit.id` where `type = REALM`.
 * 仅解析 `type = REALM` 的 `Unit.id`。
 */
export const publicRealmIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/tag/:unitId`.
 * 规范的公共浏览器路径：`/tag/:unitId`。
 *
 * Resolves only `Unit.id` where `type = TAG`.
 * 仅解析 `type = TAG` 的 `Unit.id`。
 */
export const publicTagUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/zone/:unitId`.
 * 规范的公共浏览器路径：`/zone/:unitId`。
 *
 * Resolves only `Unit.id` where `type = ZONE`.
 * 仅解析 `type = ZONE` 的 `Unit.id`。
 */
export const publicZoneUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/entity/:unitId`.
 * 规范的公共浏览器路径：`/entity/:unitId`。
 *
 * Resolves only `Unit.id` where `type = ENTITY`.
 * 仅解析 `type = ENTITY` 的 `Unit.id`。
 */
export const publicEntityUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

/**
 * Canonical public browser path: `/unit/:unitId`.
 * 规范的公共浏览器路径：`/unit/:unitId`。
 *
 * Universal UUID fallback resolving any Unit by id. When the resolved
 * Unit's type has a typed long-prefix route, the generic resolver MAY
 * redirect to that typed route per the `?view` search-param convention.
 * 通用 UUID 兜底，按 id 解析任意 Unit。当被解析 Unit 的类型存在对应的带类型
 * 长前缀路由时，通用解析器可按 `?view` 查询参数约定重定向到该带类型路由。
 */
export const publicUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
});

// ============================================================
// OWNER-SCOPED SUB-RESOURCE ROUTES
// 归属作用域下的子资源路由
// ============================================================

/**
 * Canonical public browser path: `/u/:userSlug/shelf/:slug`.
 * 规范的公共浏览器路径：`/u/:userSlug/shelf/:slug`。
 *
 * Resolves the owner USER unit via `:userSlug`, then a SHELF Unit under
 * the owner scope by `:slug`. v1 resolves only contract-defined system
 * shelf slugs (`favorites` / `saved` / `backlog` / `active` / `completed`).
 * 先通过 `:userSlug` 解析归属的 USER unit，再在该归属作用域下按 `:slug`
 * 解析 SHELF Unit。v1 仅解析契约定义的系统 shelf slug
 * （`favorites` / `saved` / `backlog` / `active` / `completed`）。
 */
export const publicUserShelfSlugRouteParamsSchema = t.Object({
  userSlug: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/r/:realmSlug/shelf/:slug`.
 * 规范的公共浏览器路径：`/r/:realmSlug/shelf/:slug`。
 *
 * Substrate only in v1 — no shelves are resolvable until a future change
 * opens realm-owned shelf creation. The route schema is exported so
 * frontend/backend route tables can wire it consistently.
 * v1 仅作为底层基础设施 —— 在未来某次变更开放 realm 拥有的 shelf 创建之前，
 * 没有 shelf 可被解析。导出该路由 schema 是为了让前后端路由表能够一致地接线。
 */
export const publicRealmShelfSlugRouteParamsSchema = t.Object({
  realmSlug: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
});

// ============================================================
// SEARCH PARAMS
// 查询参数
// ============================================================

/**
 * Public Unit resolver search params for `/unit/:unitId`.
 * `/unit/:unitId` 的公共 Unit 解析器查询参数。
 *
 * Omitted `view` is equivalent to `view=auto`. `view=auto` redirects to a
 * typed long-prefix route when one exists, while `view=unit` suppresses
 * typed redirect and renders the generic Unit view.
 * 省略 `view` 等同于 `view=auto`。当存在对应的带类型长前缀路由时，`view=auto`
 * 会重定向到该路由；而 `view=unit` 会抑制带类型重定向并渲染通用 Unit 视图。
 */
export const publicUnitResolverSearchSchema = t.Object({
  view: t.Optional(t.Union([t.Literal("auto"), t.Literal("unit")])),
});

// ============================================================
// TYPES & GUARDS
// 类型与守卫
// ============================================================

export type PublicUserSlugRouteParams =
  (typeof publicUserSlugRouteParamsSchema)["static"];
export type PublicRealmSlugRouteParams =
  (typeof publicRealmSlugRouteParamsSchema)["static"];
export type PublicTagSlugRouteParams =
  (typeof publicTagSlugRouteParamsSchema)["static"];
export type PublicZoneSlugRouteParams =
  (typeof publicZoneSlugRouteParamsSchema)["static"];
export type PublicEntitySlugRouteParams =
  (typeof publicEntitySlugRouteParamsSchema)["static"];

export type PublicUserUnitIdRouteParams =
  (typeof publicUserUnitIdRouteParamsSchema)["static"];
export type PublicRealmIdRouteParams =
  (typeof publicRealmIdRouteParamsSchema)["static"];
export type PublicTagUnitIdRouteParams =
  (typeof publicTagUnitIdRouteParamsSchema)["static"];
export type PublicZoneUnitIdRouteParams =
  (typeof publicZoneUnitIdRouteParamsSchema)["static"];
export type PublicEntityUnitIdRouteParams =
  (typeof publicEntityUnitIdRouteParamsSchema)["static"];

export type PublicUnitIdRouteParams =
  (typeof publicUnitIdRouteParamsSchema)["static"];

export type PublicUserShelfSlugRouteParams =
  (typeof publicUserShelfSlugRouteParamsSchema)["static"];
export type PublicRealmShelfSlugRouteParams =
  (typeof publicRealmShelfSlugRouteParamsSchema)["static"];

export type PublicUnitResolverSearch =
  (typeof publicUnitResolverSearchSchema)["static"];

export function isPublicUserSlugRouteParams(
  value: unknown,
): value is PublicUserSlugRouteParams {
  return Value.Check(publicUserSlugRouteParamsSchema, value);
}

export function isPublicRealmSlugRouteParams(
  value: unknown,
): value is PublicRealmSlugRouteParams {
  return Value.Check(publicRealmSlugRouteParamsSchema, value);
}

export function isPublicTagSlugRouteParams(
  value: unknown,
): value is PublicTagSlugRouteParams {
  return Value.Check(publicTagSlugRouteParamsSchema, value);
}

export function isPublicZoneSlugRouteParams(
  value: unknown,
): value is PublicZoneSlugRouteParams {
  return Value.Check(publicZoneSlugRouteParamsSchema, value);
}

export function isPublicEntitySlugRouteParams(
  value: unknown,
): value is PublicEntitySlugRouteParams {
  return Value.Check(publicEntitySlugRouteParamsSchema, value);
}

export function isPublicRealmIdRouteParams(
  value: unknown,
): value is PublicRealmIdRouteParams {
  return Value.Check(publicRealmIdRouteParamsSchema, value);
}

export function isPublicUserShelfSlugRouteParams(
  value: unknown,
): value is PublicUserShelfSlugRouteParams {
  return Value.Check(publicUserShelfSlugRouteParamsSchema, value);
}

export function isPublicRealmShelfSlugRouteParams(
  value: unknown,
): value is PublicRealmShelfSlugRouteParams {
  return Value.Check(publicRealmShelfSlugRouteParamsSchema, value);
}

export function isPublicUnitIdRouteParams(
  value: unknown,
): value is PublicUnitIdRouteParams {
  return Value.Check(publicUnitIdRouteParamsSchema, value);
}

export function isPublicUnitResolverSearch(
  value: unknown,
): value is PublicUnitResolverSearch {
  return Value.Check(publicUnitResolverSearchSchema, value);
}
