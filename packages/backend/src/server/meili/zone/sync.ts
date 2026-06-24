import { syncAllZones, syncSingleZone } from "../../../search/sync";
import { searchClient } from "../search-client";

export async function syncZoneToMeili(unitId: string): Promise<void> {
  await syncSingleZone(searchClient, unitId);
}

export async function deleteZoneFromMeili(unitId: string): Promise<void> {
  await searchClient.deleteZones([unitId]);
}

export async function syncAllZonesToMeili() {
  return syncAllZones(searchClient);
}
