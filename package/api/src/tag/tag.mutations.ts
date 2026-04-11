/**
 * React Query mutations for Tag operations
 */

import type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  DetachTagInput,
  TagVoteDTO,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { tagApi } from "./tag.api";
import { tagKeys } from "./tag.keys";

/**
 * Mutation for creating a tag
 */
export function useCreateTagMutation(
  options?: Omit<
    UseMutationOptions<UnitTagDTO, Error, CreateTagInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTagInput) => tagApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a tag
 */
export function useUpdateTagMutation(
  options?: Omit<
    UseMutationOptions<
      UnitTagDTO,
      Error,
      { unitId: string; input: UpdateTagInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => tagApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(tagKeys.detail(variables.unitId), data);
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a tag
 */
export function useDeleteTagMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => tagApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: tagKeys.detail(unitId) });
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for attaching a tag to a unit
 */
export function useAttachTagMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, AttachTagInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AttachTagInput) => tagApi.attach(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: tagKeys.forUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.tagUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for detaching a tag from a unit
 */
export function useDetachTagMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, DetachTagInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: DetachTagInput) => tagApi.detach(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: tagKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: tagKeys.forUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.tagUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for voting on a tag-unit association
 */
export function useCastTagVoteMutation(
  options?: Omit<
    UseMutationOptions<TagVoteDTO, Error, CastTagVoteInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CastTagVoteInput) => tagApi.vote(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate the tag's scored association for the unit
      queryClient.invalidateQueries({
        queryKey: tagKeys.forUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.tagUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const tagMutations = {
  useCreate: useCreateTagMutation,
  useUpdate: useUpdateTagMutation,
  useDelete: useDeleteTagMutation,
  useAttach: useAttachTagMutation,
  useDetach: useDetachTagMutation,
  useVote: useCastTagVoteMutation,
};
