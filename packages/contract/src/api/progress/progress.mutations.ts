import type {
  LinkProgressPostBody,
  NodeCompletionToggleBody,
  ProgressPostLinkDTO,
  UnitProgressRowDTO,
  UnitProgressUpsertBody,
  UpdateProgressPostLinkBody,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateForCacheDomain } from "../react-query/cache-coherence";
import { progressApi } from "./progress.api";
import { progressKeys } from "./progress.keys";

export function useUpdateUnitProgress(
  unitId: string,
  options?: Omit<
    UseMutationOptions<UnitProgressRowDTO, Error, UnitProgressUpsertBody>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UnitProgressUpsertBody) =>
      progressApi.updateUnitProgress(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(progressKeys.unit(unitId), data);
      void invalidateForCacheDomain(queryClient, "progress");
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteUnitProgress(
  unitId: string,
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, void>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => progressApi.deleteUnitProgress(unitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(progressKeys.unit(unitId), null);
      void invalidateForCacheDomain(queryClient, "progress");
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

function invalidateProgressPosts(
  queryClient: ReturnType<typeof useQueryClient>,
  unitId: string,
) {
  queryClient.invalidateQueries({ queryKey: progressKeys.unitPosts(unitId) });
  void invalidateForCacheDomain(queryClient, "progress");
}

export function useLinkProgressPost(
  unitId: string,
  options?: Omit<
    UseMutationOptions<ProgressPostLinkDTO, Error, LinkProgressPostBody>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: LinkProgressPostBody) =>
      progressApi.linkProgressPost(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateProgressPosts(queryClient, unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateProgressPostLink(
  unitId: string,
  options?: Omit<
    UseMutationOptions<
      ProgressPostLinkDTO,
      Error,
      { postUnitId: string; input: UpdateProgressPostLinkBody }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postUnitId, input }) =>
      progressApi.updateProgressPostLink(unitId, postUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateProgressPosts(queryClient, unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnlinkProgressPost(
  unitId: string,
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (postUnitId: string) =>
      progressApi.unlinkProgressPost(unitId, postUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateProgressPosts(queryClient, unitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useToggleNodeCompletion(
  unitId: string,
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, NodeCompletionToggleBody>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: NodeCompletionToggleBody) =>
      progressApi.toggleNodeCompletion(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      void invalidateForCacheDomain(queryClient, "node-completion");
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const progressMutations = {
  useUpdateUnitProgress,
  useDeleteUnitProgress,
  useLinkProgressPost,
  useUpdateProgressPostLink,
  useUnlinkProgressPost,
  useToggleNodeCompletion,
};
