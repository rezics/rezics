import { syncAllEntities, syncSingleEntity } from "@rezics/search";
import { searchClient } from "../search-client";

export async function syncEntityToMeili(unitId: string): Promise<void> {
  await syncSingleEntity(searchClient, unitId);
}

export async function deleteEntityFromMeili(unitId: string): Promise<void> {
  await searchClient.deleteEntities([unitId]);
}

export async function syncAllEntitiesToMeili() {
  return syncAllEntities(searchClient);
}
