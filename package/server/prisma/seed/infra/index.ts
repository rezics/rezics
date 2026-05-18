import type { SeedTagName, TagGroupIds } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client";
import { seedDefaultRealm } from "./seed-default-realm";
import {
  type RealmTaxonomySeedResult,
  seedRealmTaxonomy,
} from "./seed-realm-taxonomy";
import { seedContentTypeTags, seedSearchTagIds } from "./seed-tags";
import { seedSlugScopes, type SlugScopesMap } from "./seed-slug-scopes";

export { seedDefaultRealm } from "./seed-default-realm";
export {
  type RealmTaxonomySeedResult,
  seedRealmTaxonomy,
} from "./seed-realm-taxonomy";
export { seedContentTypeTags, seedSearchTagIds } from "./seed-tags";
export { seedSlugScopes, type SlugScopesMap } from "./seed-slug-scopes";

export interface SeedInfraResult {
  slugScopes: SlugScopesMap;
  tagMap: Record<SeedTagName, string>;
  defaultRealmId: string;
  realmTaxonomy: RealmTaxonomySeedResult;
  searchTagIds: TagGroupIds;
}

/**
 * Shared infrastructure seeder.
 *
 * Order is significant: slug scopes are seeded first so every subsequent
 * slug-bearing seed (tags, default realm, taxonomy) can stamp `slugScope`
 * on inserted Units. Each step is idempotent.
 */
export async function seedInfra(
  prisma: PrismaClient,
  rootUserId: string,
): Promise<SeedInfraResult> {
  const slugScopes = await seedSlugScopes(prisma);
  const tagMap = await seedContentTypeTags(prisma, slugScopes);
  const defaultRealmId = await seedDefaultRealm(prisma, rootUserId, slugScopes);
  const realmTaxonomy = await seedRealmTaxonomy(
    prisma,
    rootUserId,
    defaultRealmId,
    slugScopes,
  );
  const searchTagIds = await seedSearchTagIds(prisma, slugScopes);
  return { slugScopes, tagMap, defaultRealmId, realmTaxonomy, searchTagIds };
}
