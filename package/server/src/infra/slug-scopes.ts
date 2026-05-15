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

/** Snapshot of cached scope ids (omits missing entries). */
export function getSlugScopesSnapshot(): SlugScopesResponse {
  const snapshot: SlugScopesResponse = {};
  for (const [name, id] of cache) {
    snapshot[name] = id;
  }
  return snapshot;
}
