import type { SeedTagName } from "@rezics/contract";
import type { PrismaClient } from "#/prisma/generated/client";
import { seedDefaultRealm } from "./seed-default-realm";
import {
  seedRealmTaxonomy,
  type RealmTaxonomySeedResult,
} from "./seed-realm-taxonomy";
import { seedContentTypeTags } from "./seed-tags";

export { seedDefaultRealm } from "./seed-default-realm";
export {
  seedRealmTaxonomy,
  type RealmTaxonomySeedResult,
} from "./seed-realm-taxonomy";
export { seedContentTypeTags } from "./seed-tags";

export interface SeedInfraResult {
  tagMap: Record<SeedTagName, string>;
  defaultRealmId: string;
  realmTaxonomy: RealmTaxonomySeedResult;
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
  return { tagMap, defaultRealmId, realmTaxonomy };
}
