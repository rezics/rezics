import {
  SEED_TAG_NAMES,
  SEED_TAG_SLUGS,
  type SeedTagName,
} from "@rezics/contract";
import { and, eq, inArray } from "drizzle-orm";
import { Unit } from "../db/schema";
import { getSlugScopeId } from "./slug-scopes";

const cache = new Map<SeedTagName, string>();

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

/**
 * Look up all content-type tags by `(tagScope, slug)` and cache their IDs
 * in memory. Called once at server startup, after `initSlugScopesCache`.
 * Missing tags are logged and omitted.
 * 通过 `(tagScope, slug)` 查询所有内容类型的 tag 并将其 ID 缓存到内存中。
 * 在服务启动时调用一次，位于 `initSlugScopesCache` 之后。
 * 缺失的 tag 会被记录并忽略。
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
  const db = await getServerDb();
  const units = await db
    .select({ id: Unit.id, slug: Unit.slug })
    .from(Unit)
    .where(
      and(
        eq(Unit.slugScope, tagScope),
        inArray(Unit.slug, slugs),
        eq(Unit.type, "TAG"),
      ),
    );

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

/** Return the cached unitId for the given seed tag name, or `null` if unavailable.
 * 返回给定 seed tag 名称对应的已缓存 unitId，若不可用则返回 `null`。 */
export function getSeedTagId(name: SeedTagName): string | null {
  return cache.get(name) ?? null;
}

/** Snapshot of all cached seed tag IDs (omits missing entries).
 * 所有已缓存 seed tag ID 的快照（忽略缺失项）。 */
export function getSeedTagsSnapshot(): Partial<Record<SeedTagName, string>> {
  const snapshot: Partial<Record<SeedTagName, string>> = {};
  for (const [name, id] of cache) {
    snapshot[name] = id;
  }
  return snapshot;
}
