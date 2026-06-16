import type { RealmDock } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { realmDockApi } from "./realm-dock.api";
import { realmDockKeys } from "./realm-dock.keys";

export function realmDockQuery(realmId: string) {
  return queryOptions<RealmDock>({
    queryKey: realmDockKeys.detail(realmId),
    queryFn: () => realmDockApi.read(realmId),
    enabled: Boolean(realmId),
  });
}
