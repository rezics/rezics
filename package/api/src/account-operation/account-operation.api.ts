import type {
  AdminAuthSessionMutationResponse,
  AdminAuthUserAccountSummaryRequest,
  AdminAuthUserAccountSummaryResponse,
  AdminAuthUserSessionsRequest,
  AdminAuthUserSessionsResponse,
  AdminRevokeAuthSessionRequest,
  AdminRevokeAuthUserSessionsRequest,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const accountOperationsApi = {
  summarizeAuthUsers: async (
    input: AdminAuthUserAccountSummaryRequest,
  ): Promise<AdminAuthUserAccountSummaryResponse> => {
    return apiFetch<AdminAuthUserAccountSummaryResponse>(
      "/admin/account-operation/auth-users/summary",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
  listAuthUserSessions: async (
    input: AdminAuthUserSessionsRequest,
  ): Promise<AdminAuthUserSessionsResponse> => {
    return apiFetch<AdminAuthUserSessionsResponse>(
      "/admin/account-operation/auth-users/sessions",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
  revokeAuthUserSession: async (
    input: AdminRevokeAuthSessionRequest,
  ): Promise<AdminAuthSessionMutationResponse> => {
    return apiFetch<AdminAuthSessionMutationResponse>(
      "/admin/account-operation/auth-users/sessions/revoke",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
  revokeAuthUserSessions: async (
    input: AdminRevokeAuthUserSessionsRequest,
  ): Promise<AdminAuthSessionMutationResponse> => {
    return apiFetch<AdminAuthSessionMutationResponse>(
      "/admin/account-operation/auth-users/sessions/revoke-all",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
};
