import {
  SEED_TAG_NAMES,
  SEED_TAG_SLUGS,
  type SeedTagName,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { getSlugScopeId } from "./slug-scopes";

const cache = new Map<SeedTagName, string>();

/**
 * Look up all content-type tags by `(tagScope, slug)` and cache their IDs
 * in memory. Called once at server startup, after `initSlugScopesCache`.
 * Missing tags are logged and omitted.
 */
export async function initSeedTagsCache(): Promise<void> {
  const tagScope = getSlugScopeId("tag");
  if (!tagScope) {
    console.warn(
      `[infra] tag slug scope not seeded — seed-tag cache cannot be hydrated`,
    );
    return;
  }

  const slugs = SEED_TAG_NAMES.map((name) => SEED_TAG_SLUGS[name]);
  const units = await prisma.unit.findMany({
    where: { slugScope: tagScope, slug: { in: slugs }, type: "TAG" },
    select: { id: true, slug: true },
  });

  const bySlug = new Map<string, string>();
  for (const unit of units) {
    if (unit.slug) bySlug.set(unit.slug, unit.id);
  }

  cache.clear();
  for (const name of SEED_TAG_NAMES) {
    const slug = SEED_TAG_SLUGS[name];
    const id = bySlug.get(slug);
    if (id) {
      cache.set(name, id);
    } else {
      console.warn(
        `[infra] seed tag "${name}" (slug=${slug}) not found — accessor will return null`,
      );
    }
  }

  console.log(
    `[infra] seed tag IDs cached: ${cache.size}/${SEED_TAG_NAMES.length}`,
  );
}

/** Return the cached unitId for the given seed tag name, or `null` if unavailable. */
export function getSeedTagId(name: SeedTagName): string | null {
  return cache.get(name) ?? null;
}

/** Snapshot of all cached seed tag IDs (omits missing entries). */
export function getSeedTagsSnapshot(): Partial<Record<SeedTagName, string>> {
  const snapshot: Partial<Record<SeedTagName, string>> = {};
  for (const [name, id] of cache) {
    snapshot[name] = id;
  }
  return snapshot;
}
