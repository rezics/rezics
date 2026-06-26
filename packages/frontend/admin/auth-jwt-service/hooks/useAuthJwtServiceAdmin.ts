import type {
  JwtServiceDTO,
  JwtServiceListResponse,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
import { authJwtServiceClient, unwrapEdenResponse } from "@/lib/api-client";

const AUTH_JWT_SERVICE_LIST_KEY = [
  "eden",
  "auth",
  "jwt-services",
  "list",
] as const;

const fetchAuthJwtServices = createEdenFetcher<
  JwtServiceListResponse,
  typeof AUTH_JWT_SERVICE_LIST_KEY
>(() => authJwtServiceClient.admin["jwt-services"].get());

export function useAuthJwtServiceListQuery() {
  return useAdminEdenQuery<
    JwtServiceListResponse,
    typeof AUTH_JWT_SERVICE_LIST_KEY,
    Error
  >(AUTH_JWT_SERVICE_LIST_KEY, fetchAuthJwtServices, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
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
