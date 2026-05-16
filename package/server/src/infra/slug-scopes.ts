import {
  SLUG_SCOPES,
  type SlugScopeName,
  type SlugScopesResponse,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";

const cache = new Map<SlugScopeName, string>();

/**
 * Look up all five named slug-scope unit ids and cache them in memory.
 * Called once at server startup. Missing scopes are logged and omitted —
 * `/infra/bootstrap` callers SHALL treat the absence of a scope as a seeding
 * failure rather than as an empty namespace.
 */
export async function initSlugScopesCache(): Promise<void> {
  const rows = await prisma.slugScope.findMany({
    select: { slug: true, unitId: true },
  });

  const bySlug = new Map<string, string>(
    rows.map((row) => [row.slug, row.unitId]),
  );

  cache.clear();
  for (const name of SLUG_SCOPES) {
    const id = bySlug.get(name);
    if (id) {
      cache.set(name, id);
    } else {
      console.warn(
        `[infra] slug scope "${name}" not found — POST /slug/resolve and typed by-slug endpoints will reject this scope until it is seeded`,
      );
    }
  }

  console.log(
    `[infra] slug scope IDs cached: ${cache.size}/${SLUG_SCOPES.length}`,
  );
}

/** Return the cached unitId for a named scope, or `null` if unavailable. */
export function getSlugScopeId(name: SlugScopeName): string | null {
  return cache.get(name) ?? null;
}

/**
 * Throw-on-miss variant for code paths where the scope must exist.
 */
export function requireSlugScopeId(name: SlugScopeName): string {
  const id = cache.get(name);
  if (!id) {
    throw new Error(
      `[infra] slug scope "${name}" is not available — verify that infra seeding has run`,
    );
  }
  return id;
}

/**
 * Derive `Unit.slugScope` for a unit being created.
 *
 * - Type-scope units (USER/REALM/TAG/ZONE/ENTITY) use their own named scope.
 * - `SCOPE` units self-reference and SHALL NOT go through this helper.
 * - Owned units (BOOK/GAME/MEDIA/POST/SHELF/IMAGE/VIDEO/QUOTE/LINK) use the
 *   owner user id when available; otherwise they fall back to the entity
 *   placeholder so the column remains NOT NULL.
 */
export function pickSlugScope(
  type: string,
  ownerUserId?: string | null,
): string {
  switch (type) {
    case "USER":
      return requireSlugScopeId("user");
    case "REALM":
      return requireSlugScopeId("realm");
    case "TAG":
      return requireSlugScopeId("tag");
    case "ZONE":
      return requireSlugScopeId("zone");
    case "ENTITY":
      return requireSlugScopeId("entity");
    default:
      return ownerUserId ?? requireSlugScopeId("entity");
  }
}

/** Snapshot of cached scope ids (omits missing entries). */
export function getSlugScopesSnapshot(): SlugScopesResponse {
  const snapshot: SlugScopesResponse = {};
  for (const [name, id] of cache) {
    snapshot[name] = id;
  }
  return snapshot;
}
