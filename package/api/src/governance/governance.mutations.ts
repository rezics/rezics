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
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { postKeys } from "../post/post.keys";
import { realmKeys } from "../realm/realm.keys";
import { governanceApi } from "./governance.api";
import { governanceKeys } from "./governance.keys";

// Shared invalidation key sets — each group covers a governance write domain.
// ponytail: category-level prefixes eliminate per-entity dynamic keys.
// 共享的失效 key 集——每组覆盖一个治理写域。
// ponytail: 类别级前缀消除了每实体的动态 key。
const invalidatesEnforcement = [governanceKeys.enforcement()];
const invalidatesCases = [governanceKeys.cases()];
// ponytail: realmKeys.all() broadened from realmKeys.members(realmUnitId)
const invalidatesCapabilities = [
  governanceKeys.capabilityHints(),
  realmKeys.all(),
];
// ponytail: governanceKeys.all() covers both realmCases and global cases
// (escalation conditional on data.parentCaseId becomes unnecessary)
// ponytail: governanceKeys.all() 同时覆盖 realmCases 和全局 cases
// （基于 data.parentCaseId 的条件失效变得不再必要）
const invalidatesRealmCases = [governanceKeys.all()];
// ponytail: content moderation affects governance state + post feeds;
// postKeys.all() broadened from per-realm post keys
// ponytail: 内容审核影响治理状态和帖子流；postKeys.all() 从 per-realm 拓宽
const invalidatesContentModeration = [governanceKeys.all(), postKeys.all()];

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
  return useMutation({
    ...options,
    mutationFn: ({ targetUserId, input }) =>
      governanceApi.applyEnforcement(targetUserId, input),
    meta: { invalidates: invalidatesEnforcement },
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
  return useMutation({
    ...options,
    mutationFn: ({ targetUserId, input }) =>
      governanceApi.unblockEnforcement(targetUserId, input),
    meta: { invalidates: invalidatesEnforcement },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, userId, input }) =>
      governanceApi.grantRealmCapability(realmUnitId, userId, input),
    meta: { invalidates: invalidatesCapabilities },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, userId, capability }) =>
      governanceApi.revokeRealmCapability(realmUnitId, userId, capability),
    meta: { invalidates: invalidatesCapabilities },
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
  return useMutation({
    ...options,
    mutationFn: ({ feedbackId, input }) =>
      governanceApi.createCaseFromFeedback(feedbackId, input),
    meta: { invalidates: invalidatesCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ caseId, input }) =>
      governanceApi.duplicateCase(caseId, input),
    meta: { invalidates: invalidatesCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ caseId, input }) => governanceApi.assignCase(caseId, input),
    meta: { invalidates: invalidatesCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ caseId, input }) => governanceApi.triageCase(caseId, input),
    meta: { invalidates: invalidatesCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ caseId, input }) => governanceApi.decideCase(caseId, input),
    meta: { invalidates: invalidatesCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ caseId, input }) => governanceApi.appealCase(caseId, input),
    meta: { invalidates: invalidatesCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, input }) =>
      governanceApi.createRealmCase(realmUnitId, input),
    meta: { invalidates: invalidatesRealmCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, feedbackId, input }) =>
      governanceApi.createRealmCaseFromFeedback(realmUnitId, feedbackId, input),
    meta: { invalidates: invalidatesRealmCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, caseId, input }) =>
      governanceApi.decideRealmCase(realmUnitId, caseId, input),
    meta: { invalidates: invalidatesRealmCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, caseId, input }) =>
      governanceApi.escalateRealmCase(realmUnitId, caseId, input),
    meta: { invalidates: invalidatesRealmCases },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, targetUnitId, input }) =>
      governanceApi.restoreRealmContent(realmUnitId, targetUnitId, input),
    meta: { invalidates: invalidatesContentModeration },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, targetUnitId, input }) =>
      governanceApi.approveRealmContent(realmUnitId, targetUnitId, input),
    meta: { invalidates: invalidatesContentModeration },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, targetUnitId, input }) =>
      governanceApi.removeRealmContent(realmUnitId, targetUnitId, input),
    meta: { invalidates: invalidatesContentModeration },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, targetUnitId, isLocked, input }) =>
      governanceApi.setRealmContentLock(
        realmUnitId,
        targetUnitId,
        isLocked,
        input,
      ),
    meta: { invalidates: invalidatesContentModeration },
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
  return useMutation({
    ...options,
    mutationFn: ({ realmUnitId, targetUnitId, input }) =>
      governanceApi.requestRealmContentOwnerDelegation(
        realmUnitId,
        targetUnitId,
        input,
      ),
    meta: { invalidates: invalidatesRealmCases },
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
