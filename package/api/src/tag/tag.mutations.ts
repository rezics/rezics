/**
 * React Query mutations for Tag operations
 * Tag 操作的 React Query mutation
 */

import type {
  AttachTagInput,
  CastTagVoteInput,
  CreateTagInput,
  CreateUnitTagInput,
  DetachTagInput,
  PatchUnitTagInput,
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
 * 创建标签的 mutation
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
 * 更新标签的 mutation
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
 * 删除标签的 mutation
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
 * 将标签附加到 unit 的 mutation
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
        queryKey: tagKeys.context(variables.unitId),
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
 * 将标签从 unit 分离的 mutation
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
        queryKey: tagKeys.context(variables.unitId),
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
 * 对 tag-unit 关联投票的 mutation
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
      // 让该 unit 的标签计分关联失效
      queryClient.invalidateQueries({
        queryKey: tagKeys.forUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: tagKeys.context(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.tagUnitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

// ---- New endpoints (creation-as-vote, pin/position, delete) ----
// ---- 新端点（创建即投票、置顶/排序、删除） ----

/**
 * Create a UnitTag (creation-as-vote, idempotent per user).
 * 创建 UnitTag（创建即投票，每用户幂等）。
 * POST /unit-tag
 */
export function useCreateUnitTagMutation(
  options?: Omit<
    UseMutationOptions<UnitTagDTO, Error, CreateUnitTagInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUnitTagInput) => tagApi.createUnitTag(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: tagKeys.context(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Pin/unpin or reposition a UnitTag (admin or unit owner).
 * 置顶/取消置顶或重新排序 UnitTag（管理员或 unit 所有者）。
 * PATCH /unit-tag/:unitId/:tagUnitId
 */
export function usePatchUnitTagMutation(
  options?: Omit<
    UseMutationOptions<
      UnitTagDTO,
      Error,
      { unitId: string; tagUnitId: string; input: PatchUnitTagInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, tagUnitId, input }) =>
      tagApi.patchUnitTag(unitId, tagUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: tagKeys.context(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Delete a UnitTag (admin or unit owner).
 * 删除 UnitTag（管理员或 unit 所有者）。
 * DELETE /unit-tag/:unitId/:tagUnitId
 */
export function useDeleteUnitTagMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; tagUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, tagUnitId }) =>
      tagApi.deleteUnitTag(unitId, tagUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forUnit(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: tagKeys.context(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Withdraw the current user's own UnitTag vote. The server removes the
 * aggregate UnitTag row when this leaves no votes.
 * 撤回当前用户自己的 UnitTag 投票；若没有剩余投票，服务端会删除聚合行。
 */
export function useWithdrawUnitTagVoteMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { unitId: string; tagUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, tagUnitId }) =>
      tagApi.withdrawUnitTagVote(unitId, tagUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: tagKeys.forUnit(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: tagKeys.lowScore() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 * 合并导出的 mutation 集合
 */
export const tagMutations = {
  useCreate: useCreateTagMutation,
  useUpdate: useUpdateTagMutation,
  useDelete: useDeleteTagMutation,
  useAttach: useAttachTagMutation,
  useDetach: useDetachTagMutation,
  useVote: useCastTagVoteMutation,
  useCreateUnitTag: useCreateUnitTagMutation,
  usePatchUnitTag: usePatchUnitTagMutation,
  useDeleteUnitTag: useDeleteUnitTagMutation,
  useWithdrawUnitTagVote: useWithdrawUnitTagVoteMutation,
};
