import type { SeedTagName, TagGroupIds } from "@rezics/contract";
import { ensureRegistrationDefaultSubscriptions } from "../../../user/service/registration-defaults";
import type { ServerDb } from "../../client";
import { seedDefaultRealm } from "./seed-default-realm";
import {
  type GameMediaTaxonomySeedResult,
  seedGameMediaTaxonomy,
} from "./seed-game-media-taxonomy";
import {
  type OfficialZoneDefinition,
  seedOfficialZones,
} from "./seed-official-zones";
import {
  type RealmTaxonomySeedResult,
  seedRealmTaxonomy,
} from "./seed-realm-taxonomy";
import type { SlugScopesMap } from "./seed-slug-scopes";
import { seedContentTypeTags, seedSearchTagIds } from "./seed-tags";

export { seedDefaultRealm } from "./seed-default-realm";
export {
  type GameMediaTaxonomySeedResult,
  seedGameMediaTaxonomy,
} from "./seed-game-media-taxonomy";
export {
  OFFICIAL_ZONE_DEFINITIONS,
  type OfficialZoneDefinition,
  seedOfficialZones,
} from "./seed-official-zones";
export {
  type RealmTaxonomySeedResult,
  seedRealmTaxonomy,
} from "./seed-realm-taxonomy";
export { type SlugScopesMap, seedSlugScopes } from "./seed-slug-scopes";
export { seedContentTypeTags, seedSearchTagIds } from "./seed-tags";

export interface SeedInfraResult {
  slugScopes: SlugScopesMap;
  tagMap: Record<SeedTagName, string>;
  defaultRealmId: string;
  officialZoneIds: Record<OfficialZoneDefinition["key"], string>;
  realmTaxonomy: RealmTaxonomySeedResult;
  searchTagIds: TagGroupIds;
  gameMediaTaxonomy: GameMediaTaxonomySeedResult;
}

export interface SeedInfraOptions {
  db: Pick<ServerDb, "insert" | "select" | "transaction" | "update">;
  slugScopes: SlugScopesMap;
}

/**
 * Shared infrastructure seeder.
 *
 * Order is significant: slug scopes are seeded first so every subsequent
 * slug-bearing seed (tags, default realm, taxonomy) can stamp `slugScope`
 * on inserted Units. Each step is idempotent.
 */
export async function seedInfra(
  rootUserId: string,
  opts?: SeedInfraOptions,
): Promise<SeedInfraResult> {
  if (!opts?.slugScopes || !opts.db) {
    throw new Error(
      "seedInfra requires a Drizzle db and slugScopes from the Drizzle seedSlugScopes() step.",
    );
  }
  const { db, slugScopes } = opts;
  const tagMap = await seedContentTypeTags(db, slugScopes);
  const defaultRealmId = await seedDefaultRealm(db, rootUserId, slugScopes);
  const officialZoneIds = await seedOfficialZones(
    db,
    defaultRealmId,
    slugScopes,
  );
  // Default sidebar entries are subscription-list rows. Seed them only after
  // the default realm and official zone Units exist.
  await ensureRegistrationDefaultSubscriptions(db, rootUserId, {
    defaultRealmUnitId: defaultRealmId,
    zoneSlugScopeId: slugScopes.zone,
  });
  const realmTaxonomy = await seedRealmTaxonomy(
    db,
    rootUserId,
    defaultRealmId,
    slugScopes,
  );
  const gameMediaTaxonomy = await seedGameMediaTaxonomy(db, slugScopes);
  const searchTagIds = await seedSearchTagIds(db, slugScopes);
  return {
    slugScopes,
    tagMap,
    defaultRealmId,
    officialZoneIds,
    realmTaxonomy,
    searchTagIds,
    gameMediaTaxonomy,
  };
}
