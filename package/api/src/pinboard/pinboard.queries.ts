import type {
  PinboardAdminReadResponse,
  PinboardReadResponse,
} from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { pinboardApi } from "./pinboard.api";
import { pinboardKeys } from "./pinboard.keys";

export function pinboardReadQuery(realmId: string, placement = "home") {
  return queryOptions<PinboardReadResponse>({
    queryKey: pinboardKeys.list(realmId, placement),
    queryFn: () => pinboardApi.read(realmId, placement),
    enabled: Boolean(realmId) && Boolean(placement),
  });
}

export function pinboardAdminReadQuery(realmId: string, placement = "home") {
  return queryOptions<PinboardAdminReadResponse>({
    queryKey: pinboardKeys.admin(realmId, placement),
    queryFn: () => pinboardApi.readAdmin(realmId, placement),
    enabled: Boolean(realmId) && Boolean(placement),
  });
}
