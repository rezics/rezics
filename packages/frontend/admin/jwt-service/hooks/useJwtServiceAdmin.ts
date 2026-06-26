import type {
  JwtServiceDTO,
  JwtServiceListResponse,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

const JWT_SERVICE_LIST_KEY = ["eden", "admin", "jwt-services", "list"] as const;

const fetchJwtServices = createEdenFetcher<
  JwtServiceListResponse,
  typeof JWT_SERVICE_LIST_KEY
>(() => apiClient.admin["jwt-services"].list.get());

export function useJwtServiceListQuery() {
  return useAdminEdenQuery<
    JwtServiceListResponse,
    typeof JWT_SERVICE_LIST_KEY,
    Error
  >(JWT_SERVICE_LIST_KEY, fetchJwtServices, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
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
