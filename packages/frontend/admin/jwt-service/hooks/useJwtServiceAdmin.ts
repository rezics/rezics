import type {
  JwtServiceDTO,
  JwtServiceListResponse,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

const JWT_SERVICE_LIST_KEY = ["eden", "admin", "jwt-services", "list"] as const;

async function fetchJwtServices(): Promise<JwtServiceListResponse> {
  const response = await apiClient.admin["jwt-services"].list.get();
  return unwrapEdenResponse(response);
}

export function useJwtServiceListQuery() {
  const query = useSWR<JwtServiceListResponse>(
    JWT_SERVICE_LIST_KEY,
    fetchJwtServices,
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

export async function updateJwtService(
  serviceKey: string,
  input: UpdateJwtServiceInput,
): Promise<JwtServiceDTO> {
  const response = await apiClient.admin["jwt-services"]({
    serviceKey,
  }).patch(input);
  return unwrapEdenResponse(response);
}

export async function activateJwtService(
  serviceKey: string,
): Promise<JwtServiceDTO> {
  const response = await apiClient.admin["jwt-services"]({
    serviceKey,
  }).activate.post();
  return unwrapEdenResponse(response);
}

export async function deactivateJwtService(
  serviceKey: string,
): Promise<JwtServiceDTO> {
  const response = await apiClient.admin["jwt-services"]({
    serviceKey,
  }).deactivate.post();
  return unwrapEdenResponse(response);
}

export async function rotateJwtService(
  serviceKey: string,
): Promise<JwtServiceDTO> {
  const response = await apiClient.admin["jwt-services"]({
    serviceKey,
  }).rotate.post();
  return unwrapEdenResponse(response);
}
