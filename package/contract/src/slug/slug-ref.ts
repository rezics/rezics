import type { Static } from "elysia";
import { t } from "elysia";
import { SLUG_SCOPES } from "./scopes";

/**
 * Named-scope form: `scope` is one of the five top-level scope names.
 *
 * Use when the slug lives in a global named namespace (`user`, `realm`,
 * `tag`, `zone`, `entity`). The server resolves `scope` to a `SlugScope`
 * row's unit id and queries `Unit` by `(slugScope, slug)`.
 */
export const NamedSlugRefSchema = t.Object({
  scope: t.Union(SLUG_SCOPES.map((s) => t.Literal(s))),
  slug: t.String(),
  unitId: t.Optional(t.String()),
});

export type NamedSlugRef = Static<typeof NamedSlugRefSchema>;

/**
 * Owner-scope form: `scope` is an owner Unit id (UUID string).
 *
 * Use when the slug lives under a specific owner Unit (e.g. a SHELF under a
 * USER). The server uses the owner unit id directly as the `slugScope`
 * value when querying `Unit`.
 */
export const OwnerScopedSlugRefSchema = t.Object({
  scope: t.String({ format: "uuid" }),
  slug: t.String(),
  unitId: t.Optional(t.String()),
});

export type OwnerScopedSlugRef = Static<typeof OwnerScopedSlugRefSchema>;

/**
 * Permissive form accepting either a named scope or an owner-unit-id scope.
 *
 * This is the default shape used by request payloads where the caller may
 * carry either kind of reference. `scope` is required.
 */
export const SlugRefSchema = t.Object({
  scope: t.String(),
  slug: t.String(),
  unitId: t.Optional(t.String()),
});

export type SlugRef = Static<typeof SlugRefSchema>;
