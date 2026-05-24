/**
 * React Query mutations for Realm operations
 */

import type {
  AddRealmTagApplicationInput,
  AddRealmUnitInput,
  CastRealmTagApplicationVoteInput,
  CreateRealmInput,
  CreateRealmTagApplicationInput,
  JoinRealmInput,
  PatchRealmTagApplicationInput,
  RealmMemberDTO,
  RealmResponse,
  RealmTagApplicationDTO,
  RealmTagContextDTO,
  RealmTagContextUpdateResponse,
  RealmUnitDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
  UpdateRealmTagContextInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { tagKeys } from "../tag/tag.keys";
import { realmApi } from "./realm.api";
import { realmKeys } from "./realm.keys";

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
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: realmKeys.lists() });
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
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(realmKeys.detail(variables.unitId), data);
      queryClient.invalidateQueries({ queryKey: realmKeys.lists() });
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
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: realmKeys.detail(unitId) });
      queryClient.invalidateQueries({ queryKey: realmKeys.lists() });
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, input }) => realmApi.join(realmUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.members(variables.realmUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: realmKeys.detail(variables.realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: realmKeys.mine() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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
    ...options,
    onSuccess: (data, realmUnitId, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.members(realmUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: realmKeys.detail(realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: realmKeys.mine() });
      options?.onSuccess?.(data, realmUnitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for muting a realm — removes the Subscription edge while
 * keeping `RealmMember` intact (engagement-subscription design D5).
 * Invalidates the same membership/detail keys as join/leave so any
 * "is subscribed" derived state re-fetches.
 */
export function useMuteRealmMutation(
  options?: Omit<
    UseMutationOptions<{ muted: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (realmUnitId: string) => realmApi.mute(realmUnitId),
    ...options,
    onSuccess: (data, realmUnitId, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.detail(realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: realmKeys.mine() });
      options?.onSuccess?.(data, realmUnitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for unmuting a realm — re-adds the Subscription edge with
 * `channels=['*']`. Idempotent server-side (no-op if a subscription
 * already exists).
 */
export function useUnmuteRealmMutation(
  options?: Omit<
    UseMutationOptions<{ muted: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (realmUnitId: string) => realmApi.unmute(realmUnitId),
    ...options,
    onSuccess: (data, realmUnitId, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.detail(realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: realmKeys.mine() });
      options?.onSuccess?.(data, realmUnitId, onMutateResult, context);
    },
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, userId, input }) =>
      realmApi.updateMemberRole(realmUnitId, userId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.members(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, userId }) =>
      realmApi.removeMember(realmUnitId, userId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.members(variables.realmUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: realmKeys.detail(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

// ---- Content management mutations ----

/**
 * Mutation for adding a unit to a realm
 */
export function useAddRealmUnitMutation(
  options?: Omit<
    UseMutationOptions<
      RealmUnitDTO,
      Error,
      { realmUnitId: string; input: AddRealmUnitInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.addUnit(realmUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.units(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for removing a unit from a realm
 */
export function useRemoveRealmUnitMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { realmUnitId: string; unitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, unitId }) =>
      realmApi.removeUnit(realmUnitId, unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.units(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.addTagApplication(realmUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagApplications(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, tagUnitId, contentUnitId }) =>
      realmApi.removeTagApplication(realmUnitId, tagUnitId, contentUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagApplications(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

// ---- New realm-tag endpoints (creation-as-vote, pin/position, vote) ----

/**
 * Create a RealmTagApplication (creation-as-vote, any realm member).
 * POST /realm-tag-applications
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRealmTagApplicationInput) =>
      realmApi.createRealmTagApplication(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagApplications(variables.realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Pin/unpin or reposition a RealmTagApplication (admin or realm owner).
 * PATCH /realm-tag-applications/:realmUnitId/:unitId/:tagUnitId
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, unitId, tagUnitId, input }) =>
      realmApi.patchRealmTagApplication(realmUnitId, unitId, tagUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagApplications(variables.realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Delete a RealmTagApplication (admin or realm owner).
 * DELETE /realm-tag-applications/:realmUnitId/:unitId/:tagUnitId
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, unitId, tagUnitId }) =>
      realmApi.deleteRealmTagApplication(realmUnitId, unitId, tagUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagApplications(variables.realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Cast a RealmTagApplicationVote (membership-checked, retained on member exit).
 * POST /realm-tag-application-votes
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
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CastRealmTagApplicationVoteInput) =>
      realmApi.castRealmTagApplicationVote(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagApplications(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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
  useUpdateMemberRole: useUpdateMemberRoleMutation,
  useRemoveMember: useRemoveMemberMutation,
  useAddUnit: useAddRealmUnitMutation,
  useRemoveUnit: useRemoveRealmUnitMutation,
  useAddTagApplication: useAddRealmTagApplicationMutation,
  useRemoveTagApplication: useRemoveRealmTagApplicationMutation,
  useCreateRealmTagApplication: useCreateRealmTagApplicationMutation,
  usePatchRealmTagApplication: usePatchRealmTagApplicationMutation,
  useDeleteRealmTagApplication: useDeleteRealmTagApplicationMutation,
  useCastRealmTagApplicationVote: useCastRealmTagApplicationVoteMutation,
  useUpdateRealmTagContext: useUpdateRealmTagContextMutation,
  useMaterializeRealmTagContext: useMaterializeRealmTagContextMutation,
};
