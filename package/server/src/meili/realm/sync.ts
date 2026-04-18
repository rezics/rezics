import {
  patchRealmMemberCount,
  patchRealmMetadata,
  patchRealmTranslations,
  syncAllRealms,
  syncSingleRealm,
} from "@rezics/search";
import { searchClient } from "../search-client";

export async function syncRealmToMeili(unitId: string): Promise<void> {
  await syncSingleRealm(searchClient, unitId);
}

export async function deleteRealmFromMeili(unitId: string): Promise<void> {
  await searchClient.deleteRealms([unitId]);
}

export async function syncAllRealmsToMeili() {
  return syncAllRealms(searchClient);
}

export async function patchRealmMemberCountToMeili(
  unitId: string,
  memberCount: number,
): Promise<void> {
  await patchRealmMemberCount(searchClient, unitId, memberCount);
}

export async function patchRealmMetadataToMeili(
  unitId: string,
  fields: Record<string, any>,
): Promise<void> {
  await patchRealmMetadata(searchClient, unitId, fields);
}

export async function patchRealmTranslationsToMeili(
  unitId: string,
): Promise<void> {
  await patchRealmTranslations(searchClient, unitId);
}
