import type {
  AdminAuthSessionMutationResponse,
  AdminAuthUserSessionsResponse,
  AdminRevokeAuthSessionRequest,
  AdminRevokeAuthUserSessionsRequest,
} from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

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
