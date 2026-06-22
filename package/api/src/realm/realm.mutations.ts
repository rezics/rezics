/**
 * React Query mutations for Realm operations
 */

import type {
  AcknowledgeRealmRuleInput,
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CastRealmTagApplicationVoteInput,
  CreateRealmInput,
  CreateRealmRuleRevisionInput,
  CreateRealmTagApplicationInput,
  JoinRealmInput,
  PatchRealmTagApplicationInput,
  RealmMembershipMeDTO,
  RealmMemberDTO,
  RealmResponse,
  RealmRuleAcknowledgementDTO,
  RealmRulePolicyDTO,
  RealmRuleResolvedDTO,
  RealmTagApplicationDTO,
  RealmTagContextDTO,
  RealmTagContextUpdateResponse,
  UnitRealmDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
  UpdateRealmRulePolicyInput,
  UpdateRealmTagContextInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { cacheDomainKeys } from "../react-query/cache-coherence";
import { subscriptionKeys } from "../subscription/subscription.keys";
import { tagKeys } from "../tag/tag.keys";
import { realmApi } from "./realm.api";
import { realmKeys } from "./realm.keys";

// ponytail: root prefix — all realm sub-keys live under ["realms"]
// ponytail: 根前缀——所有 realm 子键都在 ["realms"] 下
const realmInvalidates = [realmKeys.all()];

// ponytail: cacheDomainKeys("realm-membership") covers ["users"], ["realms"]
// ponytail: cacheDomainKeys("realm-membership") 覆盖 ["users"]、["realms"]
const invalidatesRealmMembership = cacheDomainKeys("realm-membership");

// ponytail: realm+subscription — mute/unmute affects both domains
// ponytail: realm+subscription——mute/unmute 影响两个域
const realmSubscriptionInvalidates = [realmKeys.all(), subscriptionKeys.all()];

// ponytail: realm+tag — tag application mutations affect both domains
// ponytail: realm+tag——tag application mutations 影响两个域
const realmTagInvalidates = [realmKeys.all(), tagKeys.all()];

// ---- CRUD mutations ----

/**
 * Mutation for creating a realm
 */
export function useCreateRealmMutation(
  options?: Omit<
    UseMutationOptions<RealmResponse, Error, CreateRealmInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRealmInput) => realmApi.create(input),
    meta: { invalidates: realmInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(realmKeys.detail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a realm
 */
export function useUpdateRealmMutation(
  options?: Omit<
    UseMutationOptions<
      RealmResponse,
      Error,
      { unitId: string; input: UpdateRealmInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => realmApi.update(unitId, input),
    meta: { invalidates: realmInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(realmKeys.detail(variables.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a realm
 */
export function useDeleteRealmMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => realmApi.remove(unitId),
    meta: { invalidates: realmInvalidates },
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: realmKeys.detail(unitId) });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

// ---- Membership mutations ----

/**
 * Mutation for joining a realm
 */
export function useJoinRealmMutation(
  options?: Omit<
    UseMutationOptions<
      RealmMemberDTO,
      Error,
      { realmUnitId: string; input?: JoinRealmInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, input }) => realmApi.join(realmUnitId, input),
    meta: { invalidates: invalidatesRealmMembership },
    ...options,
  });
}

/**
 * Mutation for leaving a realm
 */
export function useLeaveRealmMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (realmUnitId: string) => realmApi.leave(realmUnitId),
    meta: { invalidates: invalidatesRealmMembership },
    ...options,
    onSuccess: (data, realmUnitId, onMutateResult, context) => {
      queryClient.setQueryData<RealmMembershipMeDTO | undefined>(
        realmKeys.members(realmUnitId),
        (current) =>
          current
            ? {
                ...current,
                member: null,
                roleKey: null,
                state: null,
                capabilities: [],
                muted: false,
                banned: false,
              }
            : current,
      );
      options?.onSuccess?.(data, realmUnitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for muting a realm — removes the Subscription edge while
 * keeping `RealmMember` intact.
 */
export function useMuteRealmMutation(
  options?: Omit<
    UseMutationOptions<{ muted: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (realmUnitId: string) => realmApi.mute(realmUnitId),
    meta: { invalidates: realmSubscriptionInvalidates },
    ...options,
  });
}

/**
 * Mutation for unmuting a realm — re-adds the Subscription edge with
 * `channels=['*']`. Idempotent server-side.
 */
export function useUnmuteRealmMutation(
  options?: Omit<
    UseMutationOptions<{ muted: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (realmUnitId: string) => realmApi.unmute(realmUnitId),
    meta: { invalidates: realmSubscriptionInvalidates },
    ...options,
  });
}

export function useAcknowledgeRealmRulesMutation(
  options?: Omit<
    UseMutationOptions<
      RealmRuleAcknowledgementDTO,
      Error,
      { realmUnitId: string; input?: AcknowledgeRealmRuleInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.acknowledgeRules(realmUnitId, input),
    meta: { invalidates: realmInvalidates },
    ...options,
  });
}

export function useUpdateRealmRulePolicyMutation(
  options?: Omit<
    UseMutationOptions<
      RealmRulePolicyDTO,
      Error,
      { realmUnitId: string; input: UpdateRealmRulePolicyInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.updateRulePolicy(realmUnitId, input),
    meta: { invalidates: realmInvalidates },
    ...options,
  });
}

export function useCreateRealmRuleRevisionMutation(
  options?: Omit<
    UseMutationOptions<
      RealmRuleResolvedDTO,
      Error,
      { realmUnitId: string; input: CreateRealmRuleRevisionInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.createRuleRevision(realmUnitId, input),
    meta: { invalidates: realmInvalidates },
    ...options,
  });
}

/**
 * Mutation for updating a member's role
 */
export function useUpdateMemberRoleMutation(
  options?: Omit<
    UseMutationOptions<
      RealmMemberDTO,
      Error,
      { realmUnitId: string; userId: string; input: UpdateMemberRoleInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, userId, input }) =>
      realmApi.updateMemberRole(realmUnitId, userId, input),
    meta: { invalidates: realmInvalidates },
    ...options,
  });
}

/**
 * Mutation for removing a member from a realm
 */
export function useRemoveMemberMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { realmUnitId: string; userId: string }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, userId }) =>
      realmApi.removeMember(realmUnitId, userId),
    meta: { invalidates: invalidatesRealmMembership },
    ...options,
  });
}

// ---- Content management mutations ----

/**
 * Mutation for adding a unit to a realm
 */
export function useAddUnitRealmMutation(
  options?: Omit<
    UseMutationOptions<
      UnitRealmDTO,
      Error,
      { realmUnitId: string; input: AddUnitRealmInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.addUnit(realmUnitId, input),
    meta: { invalidates: realmInvalidates },
    ...options,
  });
}

/**
 * Mutation for removing a unit from a realm
 */
export function useRemoveUnitRealmMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { realmUnitId: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, unitId }) =>
      realmApi.removeUnit(realmUnitId, unitId),
    meta: { invalidates: realmInvalidates },
    ...options,
  });
}

// ---- Tag classification mutations ----

/**
 * Mutation for adding a tag application to a realm
 */
export function useAddRealmTagApplicationMutation(
  options?: Omit<
    UseMutationOptions<
      RealmTagApplicationDTO,
      Error,
      { realmUnitId: string; input: AddRealmTagApplicationInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.addTagApplication(realmUnitId, input),
    meta: { invalidates: realmTagInvalidates },
    ...options,
  });
}

/**
 * Mutation for removing a tag application from a realm
 */
export function useRemoveRealmTagApplicationMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { realmUnitId: string; tagUnitId: string; contentUnitId: string }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, tagUnitId, contentUnitId }) =>
      realmApi.removeTagApplication(realmUnitId, tagUnitId, contentUnitId),
    meta: { invalidates: realmTagInvalidates },
    ...options,
  });
}

// ---- New realm-tag endpoints (creation-as-vote, pin/position, vote) ----

/**
 * Create a RealmTagApplication (creation-as-vote, any realm member).
 * POST /realm-tag-application
 */
export function useCreateRealmTagApplicationMutation(
  options?: Omit<
    UseMutationOptions<
      RealmTagApplicationDTO,
      Error,
      CreateRealmTagApplicationInput
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CreateRealmTagApplicationInput) =>
      realmApi.createRealmTagApplication(input),
    meta: { invalidates: realmTagInvalidates },
    ...options,
  });
}

/**
 * Pin/unpin or reposition a RealmTagApplication (admin or realm owner).
 * PATCH /realm-tag-application/:realmUnitId/:unitId/:tagUnitId
 */
export function usePatchRealmTagApplicationMutation(
  options?: Omit<
    UseMutationOptions<
      RealmTagApplicationDTO,
      Error,
      {
        realmUnitId: string;
        unitId: string;
        tagUnitId: string;
        input: PatchRealmTagApplicationInput;
      }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, unitId, tagUnitId, input }) =>
      realmApi.patchRealmTagApplication(realmUnitId, unitId, tagUnitId, input),
    meta: { invalidates: realmTagInvalidates },
    ...options,
  });
}

/**
 * Delete a RealmTagApplication (admin or realm owner).
 * DELETE /realm-tag-application/:realmUnitId/:unitId/:tagUnitId
 */
export function useDeleteRealmTagApplicationMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { realmUnitId: string; unitId: string; tagUnitId: string }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, unitId, tagUnitId }) =>
      realmApi.deleteRealmTagApplication(realmUnitId, unitId, tagUnitId),
    meta: { invalidates: realmTagInvalidates },
    ...options,
  });
}

/**
 * Cast a RealmTagApplicationVote (membership-checked, retained on member exit).
 * POST /realm-tag-application-vote
 */
export function useCastRealmTagApplicationVoteMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      CastRealmTagApplicationVoteInput
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CastRealmTagApplicationVoteInput) =>
      realmApi.castRealmTagApplicationVote(input),
    meta: { invalidates: realmTagInvalidates },
    ...options,
  });
}

/**
 * Withdraw the current member's own RealmTagApplicationVote.
 * 撤回当前成员自己的 RealmTagApplicationVote；若没有剩余投票，服务端会删除聚合行。
 */
export function useWithdrawRealmTagApplicationVoteMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { realmUnitId: string; unitId: string; tagUnitId: string }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ realmUnitId, unitId, tagUnitId }) =>
      realmApi.withdrawRealmTagApplicationVote(realmUnitId, unitId, tagUnitId),
    meta: { invalidates: realmTagInvalidates },
    ...options,
  });
}

// ---- Realm-tag interpretation context mutations ----

export function useUpdateRealmTagContextMutation(
  options?: Omit<
    UseMutationOptions<
      RealmTagContextUpdateResponse,
      Error,
      {
        realmUnitId: string;
        tagUnitId: string;
        input: UpdateRealmTagContextInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, tagUnitId, input }) =>
      realmApi.updateRealmTagContext(realmUnitId, tagUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        realmKeys.tagContext(variables.realmUnitId, variables.tagUnitId),
        { context: data },
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useMaterializeRealmTagContextMutation(
  options?: Omit<
    UseMutationOptions<
      RealmTagContextDTO,
      Error,
      { realmUnitId: string; tagUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, tagUnitId }) =>
      realmApi.materializeRealmTagContext(realmUnitId, tagUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        realmKeys.tagContext(variables.realmUnitId, variables.tagUnitId),
        { context: data },
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const realmMutations = {
  useCreate: useCreateRealmMutation,
  useUpdate: useUpdateRealmMutation,
  useDelete: useDeleteRealmMutation,
  useJoin: useJoinRealmMutation,
  useLeave: useLeaveRealmMutation,
  useMute: useMuteRealmMutation,
  useUnmute: useUnmuteRealmMutation,
  useAcknowledgeRules: useAcknowledgeRealmRulesMutation,
  useUpdateRulePolicy: useUpdateRealmRulePolicyMutation,
  useCreateRuleRevision: useCreateRealmRuleRevisionMutation,
  useUpdateMemberRole: useUpdateMemberRoleMutation,
  useRemoveMember: useRemoveMemberMutation,
  useAddUnit: useAddUnitRealmMutation,
  useRemoveUnit: useRemoveUnitRealmMutation,
  useAddTagApplication: useAddRealmTagApplicationMutation,
  useRemoveTagApplication: useRemoveRealmTagApplicationMutation,
  useCreateRealmTagApplication: useCreateRealmTagApplicationMutation,
  usePatchRealmTagApplication: usePatchRealmTagApplicationMutation,
  useDeleteRealmTagApplication: useDeleteRealmTagApplicationMutation,
  useCastRealmTagApplicationVote: useCastRealmTagApplicationVoteMutation,
  useWithdrawRealmTagApplicationVote:
    useWithdrawRealmTagApplicationVoteMutation,
  useUpdateRealmTagContext: useUpdateRealmTagContextMutation,
  useMaterializeRealmTagContext: useMaterializeRealmTagContextMutation,
};
