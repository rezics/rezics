import { useMutation } from "@tanstack/react-query";
import { accountOperationsApi } from "./account-operation.api";
import { accountOperationsKeys } from "./account-operation.keys";

export function useRevokeAuthUserSessionMutation() {
  return useMutation({
    mutationFn: accountOperationsApi.revokeAuthUserSession,
    // ponytail: root prefix; covers authUserSessions for any authUserId
    meta: { invalidates: [accountOperationsKeys.all()] },
  });
}

export function useRevokeAuthUserSessionsMutation() {
  return useMutation({
    mutationFn: accountOperationsApi.revokeAuthUserSessions,
    // ponytail: root prefix; covers authUserSessions + authUserSummary for any authUserId
    meta: { invalidates: [accountOperationsKeys.all()] },
  });
}

export function useStartAuthUserImpersonationMutation() {
  return useMutation({
    mutationFn: accountOperationsApi.startAuthUserImpersonation,
  });
}

export const accountOperationsMutations = {
  useRevokeAuthUserSession: useRevokeAuthUserSessionMutation,
  useRevokeAuthUserSessions: useRevokeAuthUserSessionsMutation,
  useStartAuthUserImpersonation: useStartAuthUserImpersonationMutation,
};
