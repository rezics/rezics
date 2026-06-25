import type {
  AccountEnforcementDTO,
  BanUserBody,
  EdenResponse,
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
} from "@/lib/api-client";

export type AuthAdminUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  banned: boolean;
  emailVerified?: boolean;
  sessions?: unknown[];
  sessionCount?: number;
  createdAt: string;
};

export type AuthAdminUsersResponse = {
  users: AuthAdminUser[];
  total?: number;
};

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

async function unwrapAuthAdminProxyResponse<T>(response: unknown): Promise<T> {
  const data = unwrapEdenResponse(response as EdenResponse<Response>);
  if (data instanceof Response) {
    const json = await data.json().catch(() => null);
    if (!data.ok) {
      const error = json?.error;
      throw new Error(
        JSON.stringify({
          status: data.status,
          code: error?.code,
          message: json?.message ?? error?.message ?? data.statusText,
          retryAfterSeconds: error?.retryAfterSeconds,
        }),
      );
    }
    return json as T;
  }
  return data as T;
}

async function fetchAuthAdminUsers(): Promise<AuthAdminUsersResponse> {
  const response = await authAdminClient.admin["list-users"].get();
  return normalizeAuthAdminUsersResponse(
    await unwrapAuthAdminProxyResponse<unknown>(response),
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
  return unwrapAuthAdminProxyResponse<AuthAdminMutationResponse>(response);
}

export async function unbanAuthAdminUser(
  input: UnbanUserBody,
): Promise<AuthAdminMutationResponse> {
  const response = await authAdminClient.admin["unban-user"].post(input);
  return unwrapAuthAdminProxyResponse<AuthAdminMutationResponse>(response);
}

export async function setAuthAdminUserRole(
  input: SetRoleBody,
): Promise<AuthAdminMutationResponse> {
  const response = await authAdminClient.admin["set-role"].post(input);
  return unwrapAuthAdminProxyResponse<AuthAdminMutationResponse>(response);
}

export async function removeAuthAdminUser(
  input: RemoveUserBody,
): Promise<AuthAdminMutationResponse> {
  const response = await authAdminClient.admin["remove-user"].post(input);
  return unwrapAuthAdminProxyResponse<AuthAdminMutationResponse>(response);
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
