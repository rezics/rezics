import type {
  JwtServiceDTO,
  JwtServiceListResponse,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import useSWR from "swr";
import { authJwtServiceClient, unwrapEdenResponse } from "@/lib/api-client";

const AUTH_JWT_SERVICE_LIST_KEY = [
  "eden",
  "auth",
  "jwt-services",
  "list",
] as const;

async function fetchAuthJwtServices(): Promise<JwtServiceListResponse> {
  const response = await authJwtServiceClient.admin["jwt-services"].get();
  return unwrapEdenResponse(response);
}

export function useAuthJwtServiceListQuery() {
  const query = useSWR<JwtServiceListResponse>(
    AUTH_JWT_SERVICE_LIST_KEY,
    fetchAuthJwtServices,
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

export async function updateAuthJwtService(
  serviceKey: string,
  input: UpdateJwtServiceInput,
): Promise<JwtServiceDTO> {
  const response = await authJwtServiceClient.admin["jwt-services"]({
    serviceKey,
  }).patch(input);
  return unwrapEdenResponse(response);
}

export async function activateAuthJwtService(
  serviceKey: string,
): Promise<JwtServiceDTO> {
  const response = await authJwtServiceClient.admin["jwt-services"]({
    serviceKey,
  }).activate.post();
  return unwrapEdenResponse(response);
}

export async function deactivateAuthJwtService(
  serviceKey: string,
): Promise<JwtServiceDTO> {
  const response = await authJwtServiceClient.admin["jwt-services"]({
    serviceKey,
  }).deactivate.post();
  return unwrapEdenResponse(response);
}

export async function rotateAuthJwtService(
  serviceKey: string,
): Promise<JwtServiceDTO> {
  const response = await authJwtServiceClient.admin["jwt-services"]({
    serviceKey,
  }).rotate.post();
  return unwrapEdenResponse(response);
}
