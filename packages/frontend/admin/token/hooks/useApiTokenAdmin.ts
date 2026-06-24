import type {
  ApiTokenDTO,
  ApiTokenListResponse,
  CreateApiTokenInput,
  CreateApiTokenResponse,
  UpdateApiTokenInput,
} from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

const API_TOKEN_LIST_KEY = ["eden", "token", "tokens"] as const;

async function fetchApiTokens(): Promise<ApiTokenListResponse> {
  const response = await apiClient.token.tokens.get();
  return unwrapEdenResponse(response);
}

export function useApiTokenListQuery() {
  const query = useSWR<ApiTokenListResponse>(
    API_TOKEN_LIST_KEY,
    fetchApiTokens,
    {
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );

  return {
    data: query.data,
    error: query.error,
    isError: Boolean(query.error),
    isFetching: query.isValidating,
    isLoading: query.isLoading,
    refetch: () => query.mutate(),
  };
}

export async function createApiToken(
  input: CreateApiTokenInput,
): Promise<CreateApiTokenResponse> {
  const response = await apiClient.token.tokens.post(input);
  return unwrapEdenResponse(response);
}

export async function updateApiToken(
  id: string,
  input: UpdateApiTokenInput,
): Promise<ApiTokenDTO> {
  const response = await apiClient.token.tokens({ id }).put(input);
  return unwrapEdenResponse(response);
}

export async function revokeApiToken(id: string): Promise<{ message: string }> {
  const response = await apiClient.token.tokens({ id }).delete();
  return unwrapEdenResponse(response);
}
