import {
  type MeiliStatusSummary,
  type SystemStatusSummary,
} from "@rezics/contract/api";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

const STATUS_REFRESH_INTERVAL_MS = 10_000;
const MEILI_STATUS_KEY = ["eden", "meili", "status"] as const;
const SYSTEM_STATUS_KEY = ["eden", "diagnostic", "system"] as const;

async function getMeiliStatus(): Promise<MeiliStatusSummary> {
  const response = await apiClient.meili.status.get();
  return unwrapEdenResponse(response);
}

async function getSystemStatus(): Promise<SystemStatusSummary> {
  const response = await apiClient.diagnostic.system.get();
  return unwrapEdenResponse(response);
}

function useAdminSWRStatusQuery<T>(
  key: readonly string[],
  fetcher: () => Promise<T>,
) {
  const query = useSWR<T>(key, fetcher, {
    refreshInterval: STATUS_REFRESH_INTERVAL_MS,
  });

  return {
    data: query.data,
    error: query.error,
    isError: Boolean(query.error),
    isFetching: query.isValidating,
    isLoading: query.isLoading,
    refetch: () => {
      void query.mutate();
    },
  };
}

export function useAdminSystemStatusQuery() {
  return useAdminSWRStatusQuery(SYSTEM_STATUS_KEY, getSystemStatus);
}

export function useAdminMeiliStatusQuery() {
  return useAdminSWRStatusQuery(MEILI_STATUS_KEY, getMeiliStatus);
}
