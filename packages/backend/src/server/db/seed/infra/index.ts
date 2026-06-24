import type { SeedTagName, TagGroupIds } from "@rezics/contract";
import type { SeedSyncHooks } from "../../factory/types";
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
  sync?: SeedSyncHooks;
}

function uniqueIds(ids: Iterable<string | undefined | null>): string[] {
  return [...new Set([...ids].filter((id): id is string => Boolean(id)))];
}

async function syncAll(
  sync: SeedSyncHooks | undefined,
  target: keyof Pick<
    SeedSyncHooks,
    "realm" | "zone" | "tag" | "entity" | "post"
  >,
  ids: Iterable<string | undefined | null>,
): Promise<void> {
  if (!sync) return;
  for (const id of uniqueIds(ids)) {
    await sync[target](id);
  }
}

function flattenTagGroupIds(tagIds: TagGroupIds): string[] {
  return uniqueIds(Object.values(tagIds).flat());
}

/**
 * Shared infrastructure seeder.
 *
 * Order is significant: slug scopes are seeded first so every subsequent
 * slug-bearing seed can stamp `slugScope` on inserted Units, and the shared
 * search tag registry is seeded before official zones so zone configs can
 * persist canonical tag Unit ids. Each step is idempotent.
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
  const { db, slugScopes, sync } = opts;
  const contentTypeTags = await seedContentTypeTags(db, slugScopes);
  await syncAll(sync, "tag", [
    ...Object.values(contentTypeTags.tagMap),
    contentTypeTags.officialQuestionTagId,
  ]);
  const searchTagIds = await seedSearchTagIds(db, slugScopes);
  await syncAll(sync, "tag", flattenTagGroupIds(searchTagIds));
  const defaultRealmId = await seedDefaultRealm(db, rootUserId, slugScopes);
  await syncAll(sync, "realm", [defaultRealmId]);
  const officialZoneIds = await seedOfficialZones(
    db,
    defaultRealmId,
    slugScopes,
    { searchTagIds },
  );
  await syncAll(sync, "zone", Object.values(officialZoneIds));
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
  await syncAll(sync, "tag", realmTaxonomy.sharedTagIds);
  await syncAll(sync, "realm", [realmTaxonomy.communityRealmId]);
  await syncAll(sync, "post", realmTaxonomy.postIds);
  const gameMediaTaxonomy = await seedGameMediaTaxonomy(db, slugScopes);
  await syncAll(
    sync,
    "entity",
    Object.values(gameMediaTaxonomy.platformEntityIds),
  );
  await syncAll(sync, "tag", Object.values(gameMediaTaxonomy.ratingTagIds));
  return {
    slugScopes,
    tagMap: contentTypeTags.tagMap,
    defaultRealmId,
    officialZoneIds,
    realmTaxonomy,
    searchTagIds,
    gameMediaTaxonomy,
  };
}
