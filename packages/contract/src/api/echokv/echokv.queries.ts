import { queryOptions } from "@tanstack/react-query";
import { echoKvApi } from "./echokv.api";

export function echoKvGetQuery(key: string) {
  return queryOptions({
    queryKey: ["echokv", key],
    queryFn: () => echoKvApi.get(key),
    staleTime: 1000 * 60 * 60 * 2,
  });
}

export function echoKvKeyListQuery(search: string) {
  return queryOptions({
    queryKey: ["echokv-keys", search],
    queryFn: () => echoKvApi.listKeys(search),
    staleTime: 1000 * 60,
  });
}
