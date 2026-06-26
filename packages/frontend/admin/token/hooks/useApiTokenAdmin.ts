import type {
  ApiTokenDTO,
  ApiTokenListResponse,
  CreateApiTokenInput,
  CreateApiTokenResponse,
  UpdateApiTokenInput,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

const API_TOKEN_LIST_KEY = ["eden", "token", "tokens"] as const;

const fetchApiTokens = createEdenFetcher<
  ApiTokenListResponse,
  typeof API_TOKEN_LIST_KEY
>(() => apiClient.token.tokens.get());

export function useApiTokenListQuery() {
  return useAdminEdenQuery(API_TOKEN_LIST_KEY, fetchApiTokens, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
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
