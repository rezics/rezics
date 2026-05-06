import type { SeedTagName, TagGroupIds } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client";
import { seedDefaultRealm } from "./seed-default-realm";
import {
  type RealmTaxonomySeedResult,
  seedRealmTaxonomy,
} from "./seed-realm-taxonomy";
import { seedContentTypeTags, seedSearchTagIds } from "./seed-tags";

export { seedDefaultRealm } from "./seed-default-realm";
export {
  type RealmTaxonomySeedResult,
  seedRealmTaxonomy,
} from "./seed-realm-taxonomy";
export { seedContentTypeTags, seedSearchTagIds } from "./seed-tags";

export interface SeedInfraResult {
  tagMap: Record<SeedTagName, string>;
  defaultRealmId: string;
  realmTaxonomy: RealmTaxonomySeedResult;
  searchTagIds: TagGroupIds;
}

/**
 * Shared infrastructure seeder. Runs tags then default realm, in order.
 * Both steps are idempotent (match by Unit.slug).
 */
export async function seedInfra(
  prisma: PrismaClient,
  rootUserId: string,
): Promise<SeedInfraResult> {
  const tagMap = await seedContentTypeTags(prisma);
  const defaultRealmId = await seedDefaultRealm(prisma, rootUserId);
  const realmTaxonomy = await seedRealmTaxonomy(
    prisma,
    rootUserId,
    defaultRealmId,
  );
  const searchTagIds = await seedSearchTagIds(prisma);
  return { tagMap, defaultRealmId, realmTaxonomy, searchTagIds };
}
