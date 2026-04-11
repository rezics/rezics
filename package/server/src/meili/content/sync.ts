import { syncSingleContent } from "@rezics/search";
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
