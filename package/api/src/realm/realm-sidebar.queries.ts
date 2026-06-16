import type { RealmSidebar } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { realmSidebarApi } from "./realm-sidebar.api";
import { realmSidebarKeys } from "./realm-sidebar.keys";

export function realmSidebarQuery(realmId: string) {
  return queryOptions<RealmSidebar>({
    queryKey: realmSidebarKeys.detail(realmId),
    queryFn: () => realmSidebarApi.read(realmId),
    enabled: Boolean(realmId),
  });
}
