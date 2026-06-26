import type {
  EchoKvKeyListResponse,
  EchoKvResponse,
  EchoKvUpsertRequest,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type EchoKvKeyListKey = readonly ["eden", "echokv", "list", string];
type EchoKvValueKey = readonly ["eden", "echokv", "value", string];

function echoKvKeyListKey(search: string): EchoKvKeyListKey {
  return ["eden", "echokv", "list", search] as const;
}

function echoKvValueKey(key: string): EchoKvValueKey {
  return ["eden", "echokv", "value", key] as const;
}

const fetchEchoKvKeys = createEdenFetcher<
  EchoKvKeyListResponse,
  EchoKvKeyListKey
>((key) => {
  const [, , , search] = key;
  const query = search.trim() ? { search: search.trim() } : {};
  return apiClient.echokv.list.get({ query });
});

const fetchEchoKvValue = createEdenFetcher<
  EchoKvResponse<unknown>,
  EchoKvValueKey
>((cacheKey) => {
  const [, , , key] = cacheKey;
  return apiClient.echokv({ key }).get();
});

export function useEchoKvKeyListQuery(search: string) {
  return useAdminEdenQuery(echoKvKeyListKey(search), fetchEchoKvKeys, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
}

export async function getEchoKvValue(
  key: string,
): Promise<EchoKvResponse<unknown>> {
  return fetchEchoKvValue(echoKvValueKey(key));
}

export async function setEchoKvValue(
  key: string,
  value: EchoKvUpsertRequest["value"],
): Promise<EchoKvResponse<unknown>> {
  const response = await apiClient.echokv({ key }).put({ value });
  return unwrapEdenResponse(response);
}
