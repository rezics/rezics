import { syncSingleRealm, syncAllRealms } from "@rezics/search";
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
