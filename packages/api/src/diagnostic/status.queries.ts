import { queryOptions, useQuery } from "@tanstack/react-query";
import { statusApi } from "./status.api";
import { statusKeys } from "./status.keys";

const STATUS_STALE_TIME_MS = 10_000;

export const statusQueryOptions = {
  meili: () =>
    queryOptions({
      queryKey: statusKeys.meili(),
      queryFn: () => statusApi.getMeiliStatus(),
      staleTime: STATUS_STALE_TIME_MS,
      refetchInterval: STATUS_STALE_TIME_MS,
    }),
  system: () =>
    queryOptions({
      queryKey: statusKeys.system(),
      queryFn: () => statusApi.getSystemStatus(),
      staleTime: STATUS_STALE_TIME_MS,
      refetchInterval: STATUS_STALE_TIME_MS,
    }),
};

export function useMeiliStatusQuery() {
  return useQuery(statusQueryOptions.meili());
}

export function useSystemStatusQuery() {
  return useQuery(statusQueryOptions.system());
}
