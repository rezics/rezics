import {
  patchEntityCreditFacets,
  patchEntitySubjectFacets,
  syncAllEntities,
  syncSingleEntity,
} from "@rezics/search";
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

export async function patchEntityCreditFacetsToMeili(
  entityId: string,
): Promise<void> {
  await patchEntityCreditFacets(searchClient, entityId);
}

export async function patchEntitySubjectFacetsToMeili(
  entityId: string,
): Promise<void> {
  await patchEntitySubjectFacets(searchClient, entityId);
}
