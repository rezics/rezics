import { useMutation, useQueryClient } from "@tanstack/react-query";
import { accountOperationsApi } from "./account-operation.api";
import { accountOperationsKeys } from "./account-operation.keys";

export function useRevokeAuthUserSessionMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountOperationsApi.revokeAuthUserSession,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: accountOperationsKeys.authUserSessions(variables.authUserId),
      });
    },
  });
}

export function useRevokeAuthUserSessionsMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: accountOperationsApi.revokeAuthUserSessions,
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({
        queryKey: accountOperationsKeys.authUserSessions(variables.authUserId),
      });
      qc.invalidateQueries({
        queryKey: accountOperationsKeys.authUserSummary([variables.authUserId]),
      });
    },
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
