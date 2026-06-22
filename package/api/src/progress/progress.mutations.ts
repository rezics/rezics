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
import { cacheDomainKeys } from "../react-query/cache-coherence";
import { progressApi } from "./progress.api";
import { progressKeys } from "./progress.keys";

// ponytail: cacheDomainKeys("progress") covers ["books"], ["users"],
// ["progress"] — the last root subsumes progressKeys.unitPosts(unitId)
// ponytail: cacheDomainKeys("progress") 覆盖 ["books"]、["users"]、
// ["progress"]——最后的根前缀涵盖了 progressKeys.unitPosts(unitId)
const invalidatesProgress = cacheDomainKeys("progress");
const invalidatesNodeCompletion = cacheDomainKeys("node-completion");

export function useUpdateUnitProgress(
  unitId: string,
  options?: Omit<
    UseMutationOptions<UnitProgressRowDTO, Error, UnitProgressUpsertBody>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    ...options,
    mutationFn: (input: UnitProgressUpsertBody) =>
      progressApi.updateUnitProgress(unitId, input),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(progressKeys.unit(unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: invalidatesProgress },
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
    ...options,
    mutationFn: () => progressApi.deleteUnitProgress(unitId),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(progressKeys.unit(unitId), null);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: invalidatesProgress },
  });
}

export function useLinkProgressPost(
  unitId: string,
  options?: Omit<
    UseMutationOptions<ProgressPostLinkDTO, Error, LinkProgressPostBody>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: (input: LinkProgressPostBody) =>
      progressApi.linkProgressPost(unitId, input),
    meta: { invalidates: invalidatesProgress },
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
  return useMutation({
    ...options,
    mutationFn: ({ postUnitId, input }) =>
      progressApi.updateProgressPostLink(unitId, postUnitId, input),
    meta: { invalidates: invalidatesProgress },
  });
}

export function useUnlinkProgressPost(
  unitId: string,
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: (postUnitId: string) =>
      progressApi.unlinkProgressPost(unitId, postUnitId),
    meta: { invalidates: invalidatesProgress },
  });
}

export function useToggleNodeCompletion(
  unitId: string,
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, NodeCompletionToggleBody>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: (input: NodeCompletionToggleBody) =>
      progressApi.toggleNodeCompletion(unitId, input),
    meta: { invalidates: invalidatesNodeCompletion },
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
