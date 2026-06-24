import {
  patchEntityAliases,
  syncAllEntities,
  syncSingleEntity,
} from "../../../search/sync";
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

export async function patchEntityAliasesToMeili(unitId: string): Promise<void> {
  await patchEntityAliases(searchClient, unitId);
}
