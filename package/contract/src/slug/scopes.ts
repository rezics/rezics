/**
 * The five named slug scopes — top-level identity namespaces.
 *
 * Each name maps to a placeholder `Unit { type: SCOPE }` row whose id is the
 * `Unit.slugScope` value for every top-level slug in that namespace. The
 * UUIDs themselves are seeded once at infra bootstrap and surfaced to the
 * client through `/infra/bootstrap`'s `slugScopes` map.
 *
 * Owner-scoped sub-resources (e.g. SHELF under a USER) bypass this list and
 * use the owner Unit's id as `slugScope` directly.
 *
 * 五个具名 slug 作用域 —— 顶层身份命名空间。
 *
 * 每个名称对应一行占位的 `Unit { type: SCOPE }`，其 id 即该命名空间下
 * 每个顶层 slug 的 `Unit.slugScope` 值。这些 UUID 在基础设施启动时
 * 一次性种入，并通过 `/infra/bootstrap` 的 `slugScopes` 映射暴露给客户端。
 *
 * 归属作用域的子资源（例如 USER 下的 SHELF）会跳过此列表，
 * 直接以所属 Unit 的 id 作为 `slugScope`。
 */
export const SLUG_SCOPES = ["user", "realm", "tag", "zone", "entity"] as const;

export type SlugScopeName = (typeof SLUG_SCOPES)[number];

/**
 * Set form of {@link SLUG_SCOPES} for O(1) membership checks.
 * {@link SLUG_SCOPES} 的集合形式，用于 O(1) 成员检查。
 */
export const SLUG_SCOPE_SET: ReadonlySet<SlugScopeName> = new Set(SLUG_SCOPES);

/**
 * Type guard distinguishing a named scope from an owner-unit-id scope.
 * 类型守卫，用于区分具名作用域与归属 unit id 作用域。
 */
export function isNamedSlugScope(value: string): value is SlugScopeName {
  return SLUG_SCOPE_SET.has(value as SlugScopeName);
}
