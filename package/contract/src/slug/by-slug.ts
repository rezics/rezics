import { t } from "elysia";
import { unitTypeSchema } from "../unit/unit";

// ============================================================
// TYPED BY-SLUG PATH PARAMS
// 类型化的 by-slug 路径参数
// ============================================================

/**
 * Path params for `GET /user/by-slug/:slug` — resolves a USER-scope slug
 * to the matching `User` extension row keyed by `unitId`.
 * `GET /user/by-slug/:slug` 的路径参数 —— 将 USER 作用域的 slug 解析为
 * 以 `unitId` 为键的对应 `User` 扩展行。
 */
export const userBySlugParamsSchema = t.Object({
  slug: t.String({ minLength: 1 }),
});

export type UserBySlugParams = (typeof userBySlugParamsSchema)["static"];

/**
 * Path params for `GET /entity/by-slug/:slug` — resolves an ENTITY-scope
 * slug. Returns 404 for every input in v1 until `entity-slug-activation`
 * permits ENTITY slug writes.
 * `GET /entity/by-slug/:slug` 的路径参数 —— 解析 ENTITY 作用域的 slug。
 * 在 v1 中对任何输入都返回 404，直到 `entity-slug-activation` 允许写入
 * ENTITY slug。
 */
export const entityBySlugParamsSchema = t.Object({
  slug: t.String({ minLength: 1 }),
});

export type EntityBySlugParams = (typeof entityBySlugParamsSchema)["static"];

/**
 * Path params for `GET /shelf/by-slug/:userSlug/:slug` — resolves the user
 * owner from `:userSlug`, then a SHELF Unit under the owner scope by
 * `:slug`. Returns 404 for any non-system-shelf slug in v1.
 * `GET /shelf/by-slug/:userSlug/:slug` 的路径参数 —— 先从 `:userSlug` 解析出
 * 用户拥有者，再按 `:slug` 在该拥有者作用域下解析 SHELF Unit。在 v1 中对任何
 * 非系统书架的 slug 返回 404。
 */
export const shelfBySlugParamsSchema = t.Object({
  userSlug: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
});

export type ShelfBySlugParams = (typeof shelfBySlugParamsSchema)["static"];

// ============================================================
// GENERIC POST /slug/resolve
// 通用的 POST /slug/resolve
// ============================================================

/**
 * Request body for `POST /slug/resolve`.
 * `POST /slug/resolve` 的请求体。
 *
 * `scope` accepts either a named scope (`'user' | 'realm' | 'tag' | 'zone'
 * | 'entity'`) or an owner Unit id (UUID string). Named scopes are looked
 * up against `SlugScope` at resolution time; owner-unit-id scopes are used
 * as-is.
 * `scope` 接受命名作用域（`'user' | 'realm' | 'tag' | 'zone' | 'entity'`）
 * 或拥有者 Unit id（UUID 字符串）。命名作用域在解析时会对照 `SlugScope`
 * 查找；拥有者 unit id 形式的作用域则按原样使用。
 */
export const slugResolvePayloadSchema = t.Object({
  scope: t.String({ minLength: 1 }),
  slug: t.String({ minLength: 1 }),
});

export type SlugResolvePayload = (typeof slugResolvePayloadSchema)["static"];

export const slugResolveResponseSchema = t.Object({
  unitId: t.String({ format: "uuid" }),
  type: unitTypeSchema,
});

export type SlugResolveResponse = (typeof slugResolveResponseSchema)["static"];
