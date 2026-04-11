/**
 * React Query mutations for Realm operations
 */

import type {
  AddRealmTagUnitInput,
  AddRealmUnitInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmMemberDTO,
  RealmResponse,
  RealmTagUnitDTO,
  RealmUnitDTO,
  RemoveRealmTagUnitInput,
  UpdateMemberRoleInput,
  UpdateRealmInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
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
      { realmUnitId: string; input: RemoveRealmTagUnitInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, input }) =>
      realmApi.removeTagUnit(realmUnitId, input),
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
};
