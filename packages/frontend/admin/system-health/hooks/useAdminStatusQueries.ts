import {
  type SystemStatusSummary,
  useMeiliStatusQuery,
} from "@rezics/contract/api";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

const STATUS_REFRESH_INTERVAL_MS = 10_000;
const SYSTEM_STATUS_KEY = ["eden", "diagnostic", "system"] as const;

async function getSystemStatus(): Promise<SystemStatusSummary> {
  const response = await apiClient.diagnostic.system.get();
  return unwrapEdenResponse<SystemStatusSummary>(response);
}

export function useAdminSystemStatusQuery() {
  const query = useSWR<SystemStatusSummary>(SYSTEM_STATUS_KEY, getSystemStatus, {
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

export function useAdminMeiliStatusQuery() {
  return useMeiliStatusQuery();
}
