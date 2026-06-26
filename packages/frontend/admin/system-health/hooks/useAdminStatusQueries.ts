import {
  type MeiliStatusSummary,
  type SystemStatusSummary,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient } from "@/lib/api-client";

const STATUS_REFRESH_INTERVAL_MS = 10_000;
const MEILI_STATUS_KEY = ["eden", "meili", "status"] as const;
const SYSTEM_STATUS_KEY = ["eden", "diagnostic", "system"] as const;

const getMeiliStatus = createEdenFetcher<
  MeiliStatusSummary,
  typeof MEILI_STATUS_KEY
>(() => apiClient.meili.status.get());

const getSystemStatus = createEdenFetcher<
  SystemStatusSummary,
  typeof SYSTEM_STATUS_KEY
>(() => apiClient.diagnostic.system.get());

export function useAdminSystemStatusQuery() {
  return useAdminEdenQuery(SYSTEM_STATUS_KEY, getSystemStatus, {
    refreshInterval: STATUS_REFRESH_INTERVAL_MS,
  });
}

export function useAdminMeiliStatusQuery() {
  return useAdminEdenQuery(MEILI_STATUS_KEY, getMeiliStatus, {
    refreshInterval: STATUS_REFRESH_INTERVAL_MS,
  });
}
