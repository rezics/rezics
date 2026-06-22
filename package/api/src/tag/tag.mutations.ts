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
  TagUnitDTO,
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

// ponytail: root prefix — all tag sub-keys (lists, detail, forUnit, context,
// lowScore) live under ["tags"], so one prefix covers every pure-invalidation hook
// ponytail: 根前缀——所有 tag 子键都在 ["tags"] 下，一个前缀覆盖所有纯失效 hook
const tagInvalidates = [tagKeys.all()];

/**
 * Mutation for creating a tag
 * 创建标签的 mutation
 */
export function useCreateTagMutation(
  options?: Omit<
    UseMutationOptions<TagUnitDTO, Error, CreateTagInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CreateTagInput) => tagApi.create(input),
    meta: { invalidates: tagInvalidates },
    ...options,
  });
}

/**
 * Mutation for updating a tag
 * 更新标签的 mutation
 */
export function useUpdateTagMutation(
  options?: Omit<
    UseMutationOptions<
      TagUnitDTO,
      Error,
      { unitId: string; input: UpdateTagInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => tagApi.update(unitId, input),
    meta: { invalidates: tagInvalidates },
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(tagKeys.detail(variables.unitId), data);
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
    meta: { invalidates: tagInvalidates },
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: tagKeys.detail(unitId) });
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
  return useMutation({
    mutationFn: (input: AttachTagInput) => tagApi.attach(input),
    meta: { invalidates: tagInvalidates },
    ...options,
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
  return useMutation({
    mutationFn: (input: DetachTagInput) => tagApi.detach(input),
    meta: { invalidates: tagInvalidates },
    ...options,
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
  return useMutation({
    mutationFn: (input: CastTagVoteInput) => tagApi.vote(input),
    meta: { invalidates: tagInvalidates },
    ...options,
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
  return useMutation({
    mutationFn: (input: CreateUnitTagInput) => tagApi.createUnitTag(input),
    meta: { invalidates: tagInvalidates },
    ...options,
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
  return useMutation({
    mutationFn: ({ unitId, tagUnitId, input }) =>
      tagApi.patchUnitTag(unitId, tagUnitId, input),
    meta: { invalidates: tagInvalidates },
    ...options,
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
  return useMutation({
    mutationFn: ({ unitId, tagUnitId }) =>
      tagApi.deleteUnitTag(unitId, tagUnitId),
    meta: { invalidates: tagInvalidates },
    ...options,
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
  return useMutation({
    mutationFn: ({ unitId, tagUnitId }) =>
      tagApi.withdrawUnitTagVote(unitId, tagUnitId),
    meta: { invalidates: tagInvalidates },
    ...options,
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
