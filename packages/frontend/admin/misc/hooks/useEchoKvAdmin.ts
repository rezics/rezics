import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type EchoKvResponse<T = unknown> = {
  value: T;
};

type EchoKvKeyListResponse = {
  keys: string[];
};

type EchoKvKeyListKey = readonly ["eden", "echokv", "list", string];

function echoKvKeyListKey(search: string): EchoKvKeyListKey {
  return ["eden", "echokv", "list", search] as const;
}

async function fetchEchoKvKeys(
  key: EchoKvKeyListKey,
): Promise<EchoKvKeyListResponse> {
  const [, , , search] = key;
  const query = search.trim() ? { search: search.trim() } : {};
  const response = await apiClient.echokv.list.get({ query });
  return unwrapEdenResponse(response);
}

export function useEchoKvKeyListQuery(search: string) {
  const query = useSWR(echoKvKeyListKey(search), fetchEchoKvKeys, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });

  return {
    data: query.data,
    error: query.error,
    isError: Boolean(query.error),
    isFetching: query.isValidating,
    isLoading: query.isLoading,
    refetch: () => query.mutate(),
  };
}

export async function getEchoKvValue(
  key: string,
): Promise<EchoKvResponse<unknown>> {
  const response = await apiClient.echokv({ key }).get();
  return unwrapEdenResponse(response);
}

export async function setEchoKvValue(
  key: string,
  value: unknown,
): Promise<EchoKvResponse<unknown>> {
  const response = await apiClient.echokv({ key }).put({ value });
  return unwrapEdenResponse(response);
}
