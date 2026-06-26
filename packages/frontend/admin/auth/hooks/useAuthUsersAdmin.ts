import type {
  AccountEnforcementDTO,
  AdminAuthUser as AuthAdminUser,
  AdminAuthUsersResponse as AuthAdminUsersResponse,
  BanUserBody,
  RemoveUserBody,
  SetRoleBody,
  UnblockAccountEnforcementInput,
  UnbanUserBody,
} from "@rezics/contract";
import useSWR from "swr";
import {
  apiClient,
  authAdminClient,
  unwrapEdenResponse,
  unwrapEdenProxyResponse,
} from "@/lib/api-client";

export type {
  AdminAuthUser as AuthAdminUser,
  AdminAuthUsersResponse as AuthAdminUsersResponse,
} from "@rezics/contract";

type AuthAdminMutationResponse = {
  success: boolean;
};

const AUTH_ADMIN_USERS_KEY = ["eden", "auth", "admin", "users"] as const;

function readString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function normalizeAuthAdminUser(value: unknown): AuthAdminUser {
  const record =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  const sessions = Array.isArray(record.sessions) ? record.sessions : undefined;
  const sessionCount =
    typeof record.sessionCount === "number" ? record.sessionCount : undefined;

  return {
    id: readString(record, "id"),
    name: readString(record, "name"),
    email: readString(record, "email"),
    role: readString(record, "role") || "user",
    banned: Boolean(record.banned),
    emailVerified:
      typeof record.emailVerified === "boolean"
        ? record.emailVerified
        : undefined,
    sessions,
    sessionCount,
    createdAt: readString(record, "createdAt"),
  };
}

function normalizeAuthAdminUsersResponse(value: unknown): AuthAdminUsersResponse {
  const record =
    value !== null && typeof value === "object"
      ? (value as Record<string, unknown>)
      : {};
  return {
    users: Array.isArray(record.users)
      ? record.users.map(normalizeAuthAdminUser)
      : [],
    total: typeof record.total === "number" ? record.total : undefined,
  };
}

async function fetchAuthAdminUsers(): Promise<AuthAdminUsersResponse> {
  const response = await authAdminClient.admin["list-users"].get();
  return normalizeAuthAdminUsersResponse(
    await unwrapEdenProxyResponse<unknown>(response),
  );
}

export function useAuthAdminUsersQuery() {
  const query = useSWR<AuthAdminUsersResponse>(
    AUTH_ADMIN_USERS_KEY,
    fetchAuthAdminUsers,
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

export async function banAuthAdminUser(
  input: BanUserBody,
): Promise<AuthAdminMutationResponse> {
  const response = await authAdminClient.admin["ban-user"].post(input);
  return unwrapEdenProxyResponse<AuthAdminMutationResponse>(response);
}

export async function unbanAuthAdminUser(
  input: UnbanUserBody,
): Promise<AuthAdminMutationResponse> {
  const response = await authAdminClient.admin["unban-user"].post(input);
  return unwrapEdenProxyResponse<AuthAdminMutationResponse>(response);
}

export async function setAuthAdminUserRole(
  input: SetRoleBody,
): Promise<AuthAdminMutationResponse> {
  const response = await authAdminClient.admin["set-role"].post(input);
  return unwrapEdenProxyResponse<AuthAdminMutationResponse>(response);
}

export async function removeAuthAdminUser(
  input: RemoveUserBody,
): Promise<AuthAdminMutationResponse> {
  const response = await authAdminClient.admin["remove-user"].post(input);
  return unwrapEdenProxyResponse<AuthAdminMutationResponse>(response);
}

export async function unblockAccountEnforcement(
  targetUserId: string,
  input: UnblockAccountEnforcementInput,
): Promise<AccountEnforcementDTO[]> {
  const response = await apiClient.governance
    .enforcement({ targetUserId })
    .unblock.post(input);
  return unwrapEdenResponse(response);
}
