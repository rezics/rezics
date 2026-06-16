import type {
  PinboardAdminReadResponse,
  PinboardReadResponse,
} from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { pinboardApi } from "./pinboard.api";
import { pinboardKeys } from "./pinboard.keys";

export function pinboardReadQuery(realmId: string, key = "home") {
  return queryOptions<PinboardReadResponse>({
    queryKey: pinboardKeys.list(realmId, key),
    queryFn: () => pinboardApi.read(realmId, key),
    enabled: Boolean(realmId) && Boolean(key),
  });
}

export function pinboardAdminReadQuery(realmId: string, key = "home") {
  return queryOptions<PinboardAdminReadResponse>({
    queryKey: pinboardKeys.admin(realmId, key),
    queryFn: () => pinboardApi.readAdmin(realmId, key),
    enabled: Boolean(realmId) && Boolean(key),
  });
}
