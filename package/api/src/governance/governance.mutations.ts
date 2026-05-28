import type {
  AppealModerationCaseInput,
  AssignModerationCaseInput,
  Capability,
  CreateAccountEnforcementInput,
  CreateModerationCaseFromFeedbackInput,
  CreateRealmModerationQueueItemFromFeedbackInput,
  CreateRealmModerationQueueItemInput,
  ContentModerationDecisionInput,
  DecideModerationCaseInput,
  DecideRealmModerationQueueItemInput,
  DuplicateModerationCaseInput,
  EscalateRealmModerationQueueItemInput,
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
import { realmKeys } from "../realm/realm.keys";
import { postKeys } from "../post/post.keys";
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

export function invalidateRealmQueueQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  realmUnitId: string,
  queueItemId?: string,
) {
  queryClient.invalidateQueries({
    queryKey: governanceKeys.realmQueue(realmUnitId),
  });
  if (queueItemId) {
    queryClient.invalidateQueries({
      queryKey: [
        ...governanceKeys.realmQueue(realmUnitId),
        "detail",
        queueItemId,
      ],
    });
  }
}

export function invalidateRealmContentModerationQueries(
  queryClient: Pick<QueryClient, "invalidateQueries">,
  realmUnitId: string,
  targetUnitId: string,
) {
  queryClient.invalidateQueries({
    queryKey: governanceKeys.realmContentModeration(realmUnitId, targetUnitId),
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

export function useCreateRealmQueueItemMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.createRealmQueueItem>>,
      Error,
      { realmUnitId: string; input: CreateRealmModerationQueueItemInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      governanceApi.createRealmQueueItem(realmUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmQueueQueries(queryClient, variables.realmUnitId, data.id);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateRealmQueueItemFromFeedbackMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<
        ReturnType<typeof governanceApi.createRealmQueueItemFromFeedback>
      >,
      Error,
      {
        realmUnitId: string;
        feedbackId: string;
        input: CreateRealmModerationQueueItemFromFeedbackInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, feedbackId, input }) =>
      governanceApi.createRealmQueueItemFromFeedback(
        realmUnitId,
        feedbackId,
        input,
      ),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmQueueQueries(queryClient, variables.realmUnitId, data.id);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDecideRealmQueueItemMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.decideRealmQueueItem>>,
      Error,
      {
        realmUnitId: string;
        queueItemId: string;
        input: DecideRealmModerationQueueItemInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, queueItemId, input }) =>
      governanceApi.decideRealmQueueItem(realmUnitId, queueItemId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmQueueQueries(
        queryClient,
        variables.realmUnitId,
        variables.queueItemId,
      );
      if (data.linkedCaseId) {
        invalidateGovernanceCaseQueries(queryClient, data.linkedCaseId);
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useEscalateRealmQueueItemMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.escalateRealmQueueItem>>,
      Error,
      {
        realmUnitId: string;
        queueItemId: string;
        input: EscalateRealmModerationQueueItemInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, queueItemId, input }) =>
      governanceApi.escalateRealmQueueItem(realmUnitId, queueItemId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmQueueQueries(
        queryClient,
        variables.realmUnitId,
        variables.queueItemId,
      );
      if (data.linkedCaseId) {
        invalidateGovernanceCaseQueries(queryClient, data.linkedCaseId);
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useHideRealmContentMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.hideRealmContent>>,
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
      governanceApi.hideRealmContent(realmUnitId, targetUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmContentModerationQueries(
        queryClient,
        variables.realmUnitId,
        variables.targetUnitId,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useTombstoneRealmContentMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.tombstoneRealmContent>>,
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
      governanceApi.tombstoneRealmContent(realmUnitId, targetUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateRealmContentModerationQueries(
        queryClient,
        variables.realmUnitId,
        variables.targetUnitId,
      );
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
      invalidateRealmContentModerationQueries(
        queryClient,
        variables.realmUnitId,
        variables.targetUnitId,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveRealmFeedRootMutation(
  options?: Omit<
    UseMutationOptions<
      Awaited<ReturnType<typeof governanceApi.removeRealmFeedRoot>>,
      Error,
      { realmUnitId: string; targetUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, targetUnitId }) =>
      governanceApi.removeRealmFeedRoot(realmUnitId, targetUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: postKeys.byRealms(variables.realmUnitId),
      });
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
      invalidateRealmQueueQueries(queryClient, variables.realmUnitId, data.id);
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
  useCreateRealmQueueItem: useCreateRealmQueueItemMutation,
  useCreateRealmQueueItemFromFeedback:
    useCreateRealmQueueItemFromFeedbackMutation,
  useDecideRealmQueueItem: useDecideRealmQueueItemMutation,
  useEscalateRealmQueueItem: useEscalateRealmQueueItemMutation,
  useHideRealmContent: useHideRealmContentMutation,
  useTombstoneRealmContent: useTombstoneRealmContentMutation,
  useRestoreRealmContent: useRestoreRealmContentMutation,
  useRemoveRealmFeedRoot: useRemoveRealmFeedRootMutation,
  useRequestRealmContentOwnerDelegation:
    useRequestRealmContentOwnerDelegationMutation,
};
