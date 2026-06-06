import type {
  RealmExtraAdminReadResponse,
  RealmExtraReadResponse,
} from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { realmExtraApi } from "./realm-extra.api";
import { realmExtraKeys } from "./realm-extra.keys";

export function realmExtraReadQuery(realmId: string, key: string) {
  return queryOptions<RealmExtraReadResponse>({
    queryKey: realmExtraKeys.list(realmId, key),
    queryFn: () => realmExtraApi.read(realmId, key),
    enabled: Boolean(realmId) && Boolean(key),
  });
}

export function realmExtraAdminReadQuery(realmId: string, key: string) {
  return queryOptions<RealmExtraAdminReadResponse>({
    queryKey: realmExtraKeys.admin(realmId, key),
    queryFn: () => realmExtraApi.readAdmin(realmId, key),
    enabled: Boolean(realmId) && Boolean(key),
  });
}
