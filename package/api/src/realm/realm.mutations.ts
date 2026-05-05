/**
 * React Query mutations for Realm operations
 */

import type {
  AddRealmTagUnitInput,
  AddRealmUnitInput,
  CastRealmTagVoteInput,
  CreateRealmInput,
  CreateRealmTagUnitInput,
  JoinRealmInput,
  PatchRealmTagUnitInput,
  RealmMemberDTO,
  RealmResponse,
  RealmTagUnitDTO,
  RealmUnitDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
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
 * Mutation for adding a tag-unit association to a realm
 */
export function useAddRealmTagUnitMutation(
  options?: Omit<
    UseMutationOptions<
      RealmTagUnitDTO,
      Error,
      { realmUnitId: string; input: AddRealmTagUnitInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.addTagUnit(realmUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagUnits(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for removing a tag-unit association from a realm
 */
export function useRemoveRealmTagUnitMutation(
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
      realmApi.removeTagUnit(realmUnitId, tagUnitId, contentUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagUnits(variables.realmUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

// ---- New realm-tag endpoints (creation-as-vote, pin/position, vote) ----

/**
 * Create a RealmTagUnit (creation-as-vote, any realm member).
 * POST /realm-tag-units
 */
export function useCreateRealmTagUnitMutation(
  options?: Omit<
    UseMutationOptions<RealmTagUnitDTO, Error, CreateRealmTagUnitInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRealmTagUnitInput) =>
      realmApi.createRealmTagUnit(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagUnits(variables.realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Pin/unpin or reposition a RealmTagUnit (admin or realm owner).
 * PATCH /realm-tag-units/:realmUnitId/:unitId/:tagUnitId
 */
export function usePatchRealmTagUnitMutation(
  options?: Omit<
    UseMutationOptions<
      RealmTagUnitDTO,
      Error,
      {
        realmUnitId: string;
        unitId: string;
        tagUnitId: string;
        input: PatchRealmTagUnitInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, unitId, tagUnitId, input }) =>
      realmApi.patchRealmTagUnit(realmUnitId, unitId, tagUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagUnits(variables.realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Delete a RealmTagUnit (admin or realm owner).
 * DELETE /realm-tag-units/:realmUnitId/:unitId/:tagUnitId
 */
export function useDeleteRealmTagUnitMutation(
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
      realmApi.deleteRealmTagUnit(realmUnitId, unitId, tagUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagUnits(variables.realmUnitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Cast a RealmTagVote (membership-checked, retained on member exit).
 * POST /realm-tag-votes
 */
export function useCastRealmTagVoteMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, CastRealmTagVoteInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CastRealmTagVoteInput) =>
      realmApi.castRealmTagVote(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: realmKeys.tagUnits(variables.realmUnitId),
      });
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
  useUpdateMemberRole: useUpdateMemberRoleMutation,
  useRemoveMember: useRemoveMemberMutation,
  useAddUnit: useAddRealmUnitMutation,
  useRemoveUnit: useRemoveRealmUnitMutation,
  useAddTagUnit: useAddRealmTagUnitMutation,
  useRemoveTagUnit: useRemoveRealmTagUnitMutation,
  useCreateRealmTagUnit: useCreateRealmTagUnitMutation,
  usePatchRealmTagUnit: usePatchRealmTagUnitMutation,
  useDeleteRealmTagUnit: useDeleteRealmTagUnitMutation,
  useCastRealmTagVote: useCastRealmTagVoteMutation,
};
