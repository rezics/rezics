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
 */
export const SLUG_SCOPES = ["user", "realm", "tag", "zone", "entity"] as const;

export type SlugScopeName = (typeof SLUG_SCOPES)[number];

/** Set form of {@link SLUG_SCOPES} for O(1) membership checks. */
export const SLUG_SCOPE_SET: ReadonlySet<SlugScopeName> = new Set(SLUG_SCOPES);

/** Type guard distinguishing a named scope from an owner-unit-id scope. */
export function isNamedSlugScope(value: string): value is SlugScopeName {
  return SLUG_SCOPE_SET.has(value as SlugScopeName);
}
