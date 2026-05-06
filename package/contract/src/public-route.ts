import { t } from "elysia";
import { Value } from "@sinclair/typebox/value";

/**
 * Canonical public browser path: `/u/:userSlug`.
 *
 * Resolves only the `User.slug` namespace for public user profiles. It never
 * resolves `Unit.slug` or `Unit.id`; callers that hold only a Unit id must use
 * the legacy `/user/:unitId` route or a user lookup before constructing this
 * public URL.
 */
export const publicUserSlugRouteParamsSchema = t.Object({
  userSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/unit/:unitSlug`.
 *
 * Resolves only the `Unit.slug` namespace for the generic Unit resolver. It
 * never resolves `User.slug` or `Unit.id`; the id fallback is explicitly
 * `/unit/id/:unitId`.
 */
export const publicUnitSlugRouteParamsSchema = t.Object({
  unitSlug: t.String({ minLength: 1 }),
});

/**
 * Canonical public browser path: `/unit/id/:unitId`.
 *
 * Resolves only the `Unit.id` namespace for technical Unit resolver fallback
 * navigation. It never resolves `Unit.slug` or `User.slug`.
 */
export const publicUnitIdRouteParamsSchema = t.Object({
  unitId: t.String({ minLength: 1 }),
});

/**
 * Public Unit resolver search params for `/unit/:unitSlug` and
 * `/unit/id/:unitId`.
 *
 * Omitted `view` is equivalent to `view=auto`. `view=auto` redirects to a
 * typed public route when one exists, while `view=unit` suppresses typed
 * redirect and renders the generic Unit view.
 */
export const publicUnitResolverSearchSchema = t.Object({
  view: t.Optional(t.Union([t.Literal("auto"), t.Literal("unit")])),
});

export type PublicUserSlugRouteParams =
  (typeof publicUserSlugRouteParamsSchema)["static"];
export type PublicUnitSlugRouteParams =
  (typeof publicUnitSlugRouteParamsSchema)["static"];
export type PublicUnitIdRouteParams =
  (typeof publicUnitIdRouteParamsSchema)["static"];
export type PublicUnitResolverSearch =
  (typeof publicUnitResolverSearchSchema)["static"];

export function isPublicUserSlugRouteParams(
  value: unknown,
): value is PublicUserSlugRouteParams {
  return Value.Check(publicUserSlugRouteParamsSchema, value);
}

export function isPublicUnitSlugRouteParams(
  value: unknown,
): value is PublicUnitSlugRouteParams {
  return Value.Check(publicUnitSlugRouteParamsSchema, value);
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
