import type {
  AppealModerationCaseInput,
  AssignModerationCaseInput,
  Capability,
  ContentModerationDecisionInput,
  CreateAccountEnforcementInput,
  CreateModerationCaseFromFeedbackInput,
  CreateRealmModerationCaseFromFeedbackInput,
  CreateRealmModerationCaseInput,
  DecideModerationCaseInput,
  DecideRealmModerationCaseInput,
  DuplicateModerationCaseInput,
  EscalateRealmModerationCaseInput,
  GrantCapabilityInput,
  TriageModerationCaseInput,
  UnblockAccountEnforcementInput,
} from "@rezics/contract";
import {
  type QueryClient,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { postKeys } from "../post/post.keys";
import { realmKeys } from "../realm/realm.keys";
import { governanceApi } from "./governance.api";
import { governanceKeys } from "./governance.keys";

export function invalidateGovernanceCaseQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  caseId?: string,
) {
  queryClient.invalidateQueries({ queryKey: governanceKeys.cases() });
  if (caseId) {
    queryClient.invalidateQueries({
      queryKey: governanceKeys.caseDetail(caseId),
    });
  }
}

export function invalidateGovernanceEnforcementQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  targetUserId: string,
) {
  queryClient.invalidateQueries({
    queryKey: governanceKeys.enforcementList(targetUserId),
  });
  queryClient.invalidateQueries({
    queryKey: governanceKeys.enforcementActive(targetUserId),
  });
}

export function invalidateRealmCapabilityQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  realmUnitId: string,
) {
  queryClient.invalidateQueries({ queryKey: governanceKeys.capabilityHints() });
  queryClient.invalidateQueries({ queryKey: realmKeys.members(realmUnitId) });
}

export function invalidateRealmCaseQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  realmUnitId: string,
  caseId?: string,
) {
  queryClient.invalidateQueries({
    queryKey: governanceKeys.realmCases(realmUnitId),
  });
  if (caseId) {
    queryClient.invalidateQueries({
      queryKey: [...governanceKeys.realmCases(realmUnitId), "detail", caseId],
    });
  }
}

export function invalidateRealmUnitStateQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  realmUnitId: string,
  targetUnitId: string,
) {
  queryClient.invalidateQueries({
    queryKey: governanceKeys.realmUnitState(realmUnitId, targetUnitId),
  });
  queryClient.invalidateQueries({
    queryKey: postKeys.byRealms(realmUnitId),
  });
  queryClient.invalidateQueries({
    queryKey: postKeys.moderationOverlays(realmUnitId, [targetUnitId]),
  });
}

export function useApplyAccountEnforcementMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.applyEnforcement>>,
      Error,
      { targetUserId: string; input: CreateAccountEnforcementInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetUserId, input }) =>
      governanceApi.applyEnforcement(targetUserId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateGovernanceEnforcementQueries(
        queryClient,
        variables.targetUserId,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnblockAccountEnforcementMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.unblockEnforcement>>,
      Error,
      { targetUserId: string; input: UnblockAccountEnforcementInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ targetUserId, input }) =>
      governanceApi.unblockEnforcement(targetUserId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateGovernanceEnforcementQueries(
        queryClient,
        variables.targetUserId,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useGrantRealmCapabilityMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.grantRealmCapability>>,
      Error,
      { realmUnitId: string; userId: string; input: GrantCapabilityInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, userId, input }) =>
      governanceApi.grantRealmCapability(realmUnitId, userId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmCapabilityQueries(queryClient, variables.realmUnitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRevokeRealmCapabilityMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.revokeRealmCapability>>,
      Error,
      { realmUnitId: string; userId: string; capability: Capability }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, userId, capability }) =>
      governanceApi.revokeRealmCapability(realmUnitId, userId, capability),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmCapabilityQueries(queryClient, variables.realmUnitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateModerationCaseFromFeedbackMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.createCaseFromFeedback>>,
      Error,
      { feedbackId: string; input: CreateModerationCaseFromFeedbackInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ feedbackId, input }) =>
      governanceApi.createCaseFromFeedback(feedbackId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateGovernanceCaseQueries(queryClient, data.id);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDuplicateModerationCaseMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.duplicateCase>>,
      Error,
      { caseId: string; input: DuplicateModerationCaseInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, input }) =>
      governanceApi.duplicateCase(caseId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateGovernanceCaseQueries(queryClient, variables.caseId);
      invalidateGovernanceCaseQueries(queryClient, data.id);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useAssignModerationCaseMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.assignCase>>,
      Error,
      { caseId: string; input: AssignModerationCaseInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, input }) => governanceApi.assignCase(caseId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateGovernanceCaseQueries(queryClient, variables.caseId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useTriageModerationCaseMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.triageCase>>,
      Error,
      { caseId: string; input: TriageModerationCaseInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, input }) => governanceApi.triageCase(caseId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateGovernanceCaseQueries(queryClient, variables.caseId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDecideModerationCaseMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.decideCase>>,
      Error,
      { caseId: string; input: DecideModerationCaseInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, input }) => governanceApi.decideCase(caseId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateGovernanceCaseQueries(queryClient, variables.caseId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useAppealModerationCaseMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.appealCase>>,
      Error,
      { caseId: string; input: AppealModerationCaseInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ caseId, input }) => governanceApi.appealCase(caseId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateGovernanceCaseQueries(queryClient, variables.caseId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateRealmCaseMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.createRealmCase>>,
      Error,
      { realmUnitId: string; input: CreateRealmModerationCaseInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      governanceApi.createRealmCase(realmUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmCaseQueries(queryClient, variables.realmUnitId, data.id);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateRealmCaseFromFeedbackMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.createRealmCaseFromFeedback>>,
      Error,
      {
        realmUnitId: string;
        feedbackId: string;
        input: CreateRealmModerationCaseFromFeedbackInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, feedbackId, input }) =>
      governanceApi.createRealmCaseFromFeedback(realmUnitId, feedbackId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmCaseQueries(queryClient, variables.realmUnitId, data.id);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDecideRealmCaseMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.decideRealmCase>>,
      Error,
      {
        realmUnitId: string;
        caseId: string;
        input: DecideRealmModerationCaseInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, caseId, input }) =>
      governanceApi.decideRealmCase(realmUnitId, caseId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmCaseQueries(
        queryClient,
        variables.realmUnitId,
        variables.caseId,
      );
      if (data.parentCaseId) {
        invalidateGovernanceCaseQueries(queryClient, data.parentCaseId);
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useEscalateRealmCaseMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.escalateRealmCase>>,
      Error,
      {
        realmUnitId: string;
        caseId: string;
        input: EscalateRealmModerationCaseInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, caseId, input }) =>
      governanceApi.escalateRealmCase(realmUnitId, caseId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmCaseQueries(
        queryClient,
        variables.realmUnitId,
        variables.caseId,
      );
      if (data.parentCaseId) {
        invalidateGovernanceCaseQueries(queryClient, data.parentCaseId);
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRestoreRealmContentMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.restoreRealmContent>>,
      Error,
      {
        realmUnitId: string;
        targetUnitId: string;
        input: ContentModerationDecisionInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, targetUnitId, input }) =>
      governanceApi.restoreRealmContent(realmUnitId, targetUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmUnitStateQueries(
        queryClient,
        variables.realmUnitId,
        variables.targetUnitId,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useApproveRealmContentMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.approveRealmContent>>,
      Error,
      {
        realmUnitId: string;
        targetUnitId: string;
        input: ContentModerationDecisionInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, targetUnitId, input }) =>
      governanceApi.approveRealmContent(realmUnitId, targetUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmUnitStateQueries(
        queryClient,
        variables.realmUnitId,
        variables.targetUnitId,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveRealmContentMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.removeRealmContent>>,
      Error,
      {
        realmUnitId: string;
        targetUnitId: string;
        input: ContentModerationDecisionInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, targetUnitId, input }) =>
      governanceApi.removeRealmContent(realmUnitId, targetUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmUnitStateQueries(
        queryClient,
        variables.realmUnitId,
        variables.targetUnitId,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useSetRealmContentLockMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.setRealmContentLock>>,
      Error,
      {
        realmUnitId: string;
        targetUnitId: string;
        isLocked: boolean;
        input: ContentModerationDecisionInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, targetUnitId, isLocked, input }) =>
      governanceApi.setRealmContentLock(
        realmUnitId,
        targetUnitId,
        isLocked,
        input,
      ),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmUnitStateQueries(
        queryClient,
        variables.realmUnitId,
        variables.targetUnitId,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRequestRealmContentOwnerDelegationMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<
        ReturnType<typeof governanceApi.requestRealmContentOwnerDelegation>
      >,
      Error,
      {
        realmUnitId: string;
        targetUnitId: string;
        input: ContentModerationDecisionInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, targetUnitId, input }) =>
      governanceApi.requestRealmContentOwnerDelegation(
        realmUnitId,
        targetUnitId,
        input,
      ),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmCaseQueries(queryClient, variables.realmUnitId, data.id);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const governanceMutations = {
  useApplyEnforcement: useApplyAccountEnforcementMutation,
  useUnblockEnforcement: useUnblockAccountEnforcementMutation,
  useGrantRealmCapability: useGrantRealmCapabilityMutation,
  useRevokeRealmCapability: useRevokeRealmCapabilityMutation,
  useCreateCaseFromFeedback: useCreateModerationCaseFromFeedbackMutation,
  useDuplicateCase: useDuplicateModerationCaseMutation,
  useAssignCase: useAssignModerationCaseMutation,
  useTriageCase: useTriageModerationCaseMutation,
  useDecideCase: useDecideModerationCaseMutation,
  useAppealCase: useAppealModerationCaseMutation,
  useCreateRealmCase: useCreateRealmCaseMutation,
  useCreateRealmCaseFromFeedback: useCreateRealmCaseFromFeedbackMutation,
  useDecideRealmCase: useDecideRealmCaseMutation,
  useEscalateRealmCase: useEscalateRealmCaseMutation,
  useRestoreRealmContent: useRestoreRealmContentMutation,
  useApproveRealmContent: useApproveRealmContentMutation,
  useRemoveRealmContent: useRemoveRealmContentMutation,
  useSetRealmContentLock: useSetRealmContentLockMutation,
  useRequestRealmContentOwnerDelegation:
    useRequestRealmContentOwnerDelegationMutation,
};
