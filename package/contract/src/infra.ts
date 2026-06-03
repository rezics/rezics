import { t } from "elysia";
import { SLUG_SCOPES, type SlugScopeName } from "./slug";
import { SEED_TAG_NAMES, type SeedTagName } from "./tag/seed-tags";

/**
 * Named-scope unitId map surfaced by `/infra/bootstrap`.
 *
 * Each key corresponds to a placeholder `Unit { type: SCOPE }` row. The
 * client caches these UUIDs permanently and invalidates them on app
 * version-stamp bump. Clients never construct routes from these UUIDs
 * directly; they pass the named-scope string to `POST /slug/resolve` or
 * to typed by-slug endpoints.
 */
export const slugScopesResponseSchema = t.Partial(
  t.Object(
    Object.fromEntries(SLUG_SCOPES.map((name) => [name, t.String()])) as {
      [K in SlugScopeName]: ReturnType<typeof t.String>;
    },
  ),
);

export type SlugScopesResponse = Partial<Record<SlugScopeName, string>>;

export const infraBootstrapResponseSchema = t.Object({
  seedTags: t.Partial(
    t.Object(
      Object.fromEntries(SEED_TAG_NAMES.map((name) => [name, t.String()])) as {
        [K in SeedTagName]: ReturnType<typeof t.String>;
      },
    ),
  ),
  defaultRealmId: t.Optional(t.String()),
  slugScopes: slugScopesResponseSchema,
});

export type InfraBootstrapResponse = {
  seedTags: Partial<Record<SeedTagName, string>>;
  defaultRealmId?: string;
  slugScopes: SlugScopesResponse;
};
