import type {
  AdminAuthSessionMutationResponse,
  AdminAuthUserAccountSummaryResponse,
  AdminAuthUserSessionsResponse,
  AdminRevokeAuthSessionRequest,
  AdminRevokeAuthUserSessionsRequest,
  AdminStartAuthImpersonationRequest,
  AdminStartAuthImpersonationResponse,
} from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

function authUserSummaryKey(authUserIds: readonly string[]) {
  return [
    "eden",
    "admin",
    "account-operation",
    "auth-users",
    "summary",
    [...authUserIds],
  ] as const;
}

function authUserSessionsKey(authUserId: string) {
  return [
    "eden",
    "admin",
    "account-operation",
    "auth-users",
    "sessions",
    authUserId,
  ] as const;
}

async function fetchAuthUserAccountSummary(
  authUserIds: readonly string[],
): Promise<AdminAuthUserAccountSummaryResponse> {
  const response =
    await apiClient.admin["account-operation"]["auth-users"].summary.post({
      authUserIds: [...authUserIds],
    });
  return unwrapEdenResponse(response);
}

export function useAuthUserAccountSummaryQuery(authUserIds: readonly string[]) {
  const query = useSWR<AdminAuthUserAccountSummaryResponse>(
    authUserIds.length > 0 ? authUserSummaryKey(authUserIds) : null,
    () => fetchAuthUserAccountSummary(authUserIds),
    {
      dedupingInterval: 30_000,
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

async function fetchAuthUserSessions(
  authUserId: string,
): Promise<AdminAuthUserSessionsResponse> {
  const response =
    await apiClient.admin["account-operation"]["auth-users"].sessions.post({
      authUserId,
    });
  return unwrapEdenResponse(response);
}

export function useAuthUserSessionsQuery(authUserId: string) {
  const query = useSWR<AdminAuthUserSessionsResponse>(
    authUserId ? authUserSessionsKey(authUserId) : null,
    () => fetchAuthUserSessions(authUserId),
    {
      dedupingInterval: 30_000,
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

export async function revokeAuthUserSession(
  input: AdminRevokeAuthSessionRequest,
): Promise<AdminAuthSessionMutationResponse> {
  const response =
    await apiClient.admin["account-operation"]["auth-users"].sessions.revoke.post(
      input,
    );
  return unwrapEdenResponse(response);
}

export async function revokeAuthUserSessions(
  input: AdminRevokeAuthUserSessionsRequest,
): Promise<AdminAuthSessionMutationResponse> {
  const response =
    await apiClient.admin["account-operation"]["auth-users"].sessions[
      "revoke-all"
    ].post(input);
  return unwrapEdenResponse(response);
}

export async function startAuthUserImpersonation(
  input: AdminStartAuthImpersonationRequest,
): Promise<AdminStartAuthImpersonationResponse> {
  const response =
    await apiClient.admin["account-operation"]["auth-users"].impersonate.post(
      input,
    );
  return unwrapEdenResponse(response);
}
