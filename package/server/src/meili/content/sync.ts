import {
  patchContentContainedUnitIds,
  patchContentCredits,
  patchContentMetadata,
  patchContentRealmIds,
  patchContentRealmTagKeys,
  patchContentTags,
  patchContentTranslations,
  syncSingleContent,
} from "@rezics/search";
import { searchClient } from "../search-client";

/**
 * Sync a single unit's content document to Meilisearch.
 * If the unit no longer qualifies for indexing, it will be removed.
 */
export async function syncContentToMeili(unitId: string): Promise<void> {
  await syncSingleContent(searchClient, unitId);
}

/**
 * Remove a single unit's content document from Meilisearch.
 */
export async function deleteContentFromMeili(unitId: string): Promise<void> {
  await searchClient.deleteContent([unitId]);
}

export async function patchContentTagsToMeili(unitId: string): Promise<void> {
  await patchContentTags(searchClient, unitId);
}

export async function patchContentCreditsToMeili(
  unitId: string,
): Promise<void> {
  await patchContentCredits(searchClient, unitId);
}

export async function patchContentTranslationsToMeili(
  unitId: string,
): Promise<void> {
  await patchContentTranslations(searchClient, unitId);
}

export async function patchContentRealmIdsToMeili(
  unitId: string,
): Promise<void> {
  await patchContentRealmIds(searchClient, unitId);
}

export async function patchContentRealmTagKeysToMeili(
  unitId: string,
): Promise<void> {
  await patchContentRealmTagKeys(searchClient, unitId);
}

export async function patchContentMetadataToMeili(
  unitId: string,
  fields: Record<string, any>,
): Promise<void> {
  await patchContentMetadata(searchClient, unitId, fields);
}

export async function patchContentContainedUnitIdsToMeili(
  shelfUnitId: string,
): Promise<void> {
  await patchContentContainedUnitIds(searchClient, shelfUnitId);
}
