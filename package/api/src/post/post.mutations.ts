import type {
  AcceptAnswerInput,
  CommentPromotionDTO,
  EditorialPatchSubmission,
  PinCommentInput,
  PostResponse,
  SetPostStateInput,
  SubmitPostToRealmInput,
  UpdatePostInput,
} from "@rezics/contract";
import {
  type QueryClient,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { commentKeys } from "../comment/comment.keys";
import { feedKeys } from "../feed/feed.keys";
import { invalidateForCacheDomain } from "../react-query/cache-coherence";
import { unitKeys } from "../unit/unit.keys";
import { postApi } from "./post.api";
import { postKeys } from "./post.keys";
import type { CreateRootPostInput } from "./post.types";

type PostMutationCacheSyncInput = {
  queryClient: QueryClient;
  unitId: string;
  data?: PostResponse;
  removeDetail?: boolean;
  targetUnitIds?: readonly (string | null | undefined)[];
  variantUnitIds?: readonly (string | null | undefined)[];
  realmUnitIds?: readonly (string | null | undefined)[];
  authorUserIds?: readonly (string | null | undefined)[];
};

function compactIds(ids: readonly (string | null | undefined)[] = []) {
  return [...new Set(ids.filter((id): id is string => Boolean(id)))];
}

/**
 * Keeps post writes coherent across the split post/unit read surfaces.
 * Scoped list prefixes are intentionally over-invalidated: latest ordering and
 * membership depend on filters, moderation, language, realm, target, and time,
 * so refetching is safer than per-sort cache surgery.
 * 在拆分的 post/unit 读取面之间保持 post 写入的一致性。
 * 受范围限制的列表前缀被有意地过度失效：最新排序和成员关系依赖于过滤器、审核、
 * 语言、realm、target 和时间，因此重新获取比按排序逐一修改缓存更安全。
 */
export async function syncPostMutationCache({
  queryClient,
  unitId,
  data,
  removeDetail = false,
  targetUnitIds = [],
  variantUnitIds = [],
  realmUnitIds = [],
  authorUserIds = [],
}: PostMutationCacheSyncInput) {
  const resolvedUnitId = data?.unitId ?? unitId;

  if (removeDetail) {
    queryClient.removeQueries({ queryKey: postKeys.detail(resolvedUnitId) });
  } else if (data) {
    queryClient.setQueryData(postKeys.detail(resolvedUnitId), data);
  }

  const invalidations: Promise<unknown>[] = [
    queryClient.invalidateQueries({
      queryKey: postKeys.detail(resolvedUnitId),
    }),
    queryClient.invalidateQueries({
      queryKey: unitKeys.languages(resolvedUnitId),
    }),
    queryClient.invalidateQueries({ queryKey: postKeys.lists() }),
    // Feed rows depend on post membership — invalidate so the home feed
    // reflects creates, updates, and deletes.
    // 动态行依赖帖子成员关系——使其失效，以便首页动态反映创建、更新和删除。
    queryClient.invalidateQueries({ queryKey: feedKeys.root }),
  ];

  for (const targetUnitId of compactIds([
    data?.targetUnitId,
    ...targetUnitIds,
  ])) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: postKeys.byTargets(targetUnitId),
      }),
    );
  }

  for (const variantUnitId of compactIds([
    data?.variantUnitId,
    ...variantUnitIds,
  ])) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: postKeys.byVariants(variantUnitId),
      }),
    );
  }

  for (const realmUnitId of compactIds([data?.realmUnitId, ...realmUnitIds])) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: postKeys.byRealms(realmUnitId),
      }),
    );
  }

  for (const authorUserId of compactIds([
    data?.authorUserId,
    ...authorUserIds,
  ])) {
    invalidations.push(
      queryClient.invalidateQueries({
        queryKey: postKeys.byAuthors(authorUserId),
      }),
    );
  }

  await Promise.all(invalidations);
}

export function useCreatePostMutation(
  options?: Omit<
    UseMutationOptions<PostResponse, Error, CreateRootPostInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRootPostInput) => postApi.create(input),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await syncPostMutationCache({
        queryClient,
        unitId: data.unitId,
        data,
        targetUnitIds: [variables.targetUnitId],
        variantUnitIds: [variables.variantUnitId],
        realmUnitIds: variables.realmUnitIds,
      });

      // A draft create adds to the drafts list; route through the draft cache
      // domain so draft readers refresh.
      // 创建草稿会将其加入草稿列表；通过 draft 缓存域路由，使草稿读取方刷新。
      if (variables.status === "DRAFT") {
        await invalidateForCacheDomain(queryClient, "draft");
      }

      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateWikiPostMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      Omit<CreateRootPostInput, "kind" | "creationMode">
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => postApi.createWiki(input),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await syncPostMutationCache({
        queryClient,
        unitId: data.unitId,
        data,
        targetUnitIds: [variables.targetUnitId],
        variantUnitIds: [variables.variantUnitId],
        realmUnitIds: variables.realmUnitIds,
      });
      // A draft wiki create surfaces in the drafts list.
      // 创建 wiki 草稿会出现在草稿列表中。
      if (variables.status === "DRAFT") {
        await invalidateForCacheDomain(queryClient, "draft");
      }
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdatePostMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      { unitId: string; input: EditorialPatchSubmission }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => postApi.update(unitId, input),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await syncPostMutationCache({
        queryClient,
        unitId: variables.unitId,
        data,
      });
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateWikiPostContentMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      {
        unitId: string;
        title?: UpdatePostInput["title"];
        content: UpdatePostInput["content"];
        language?: UpdatePostInput["language"];
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, title, content, language }) =>
      postApi.updateWikiContent(unitId, { title, content, language }),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await syncPostMutationCache({
        queryClient,
        unitId: variables.unitId,
        data,
      });
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeletePostMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => postApi.remove(unitId),
    ...options,
    onSuccess: async (data, unitId, onMutateResult, context) => {
      await syncPostMutationCache({
        queryClient,
        unitId,
        removeDetail: true,
      });
      // Delete only has the bare unitId — no target/realm/author context — so
      // broadly invalidate all scoped post lists that may have contained it.
      // 删除时只有裸 unitId——无 target/realm/author 上下文——因此广泛失效
      // 所有可能包含该帖子的受限 post 列表。
      await queryClient.invalidateQueries({ queryKey: postKeys.all() });
      await options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Publish a draft post or revert a published post to draft. Routes
 * invalidation through the `draft` cache domain (drafts list) and
 * refreshes post lists/detail so the post appears/disappears consistently.
 * 发布草稿 post，或将已发布的 post 还原为草稿。通过 `draft` 缓存域
 *（草稿列表）路由失效，并刷新 post 列表/详情，使 post 一致地出现/消失。
 */
export function useSetPostPublicationMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      { unitId: string; publish: boolean }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, publish }) =>
      postApi.setPublication(unitId, { publish }),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all([
        syncPostMutationCache({
          queryClient,
          unitId: variables.unitId,
          data,
        }),
        invalidateForCacheDomain(queryClient, "draft"),
      ]);
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useSubmitPostToRealmMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      { unitId: string; input: SubmitPostToRealmInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => postApi.submitToRealm(unitId, input),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all([
        syncPostMutationCache({
          queryClient,
          unitId: variables.unitId,
          data,
          realmUnitIds: [variables.input.realmUnitId],
        }),
        invalidateForCacheDomain(queryClient, "draft"),
      ]);
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Transition a post's lifecycle state. The server validates the transition
 * against the post's schema; on success we refresh the post detail (badge
 * rendering) and its thread (a root-post close/reopen changes thread-level
 * affordances), plus lists so bucket filters (active/closed) recompute.
 * 转换 post 的生命周期状态。服务器会根据 post 的 schema 校验该转换；成功后我们刷新
 * post 详情（徽章渲染）及其 thread（根 post 的关闭/重开会改变 thread 级别的可操作项），
 * 以及列表，使分桶过滤器（active/closed）重新计算。
 */
export function useSetPostStateMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      { unitId: string; input: SetPostStateInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => postApi.setState(unitId, input),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await Promise.all([
        syncPostMutationCache({
          queryClient,
          unitId: variables.unitId,
          data,
        }),
        queryClient.invalidateQueries({
          queryKey: commentKeys.all(),
        }),
      ]);
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Promotion mutations (pin / unpin / accept / unaccept).
 *
 * Each mutation targets a reply within a thread scope and, on settle, refreshes
 * the thread query so promotion badges (`CommentPromotionBadge`) and sibling
 * ordering (`orderSiblingsByPromotion`) recompute from server truth.
 * Invalidating on settle — not just success — means a stale `403` re-syncs the
 * thread to the server's view rather than leaving a falsely-applied control. The server gate
 * (`assertCanPromoteInThread`) remains the single authorization source; these
 * hooks never re-implement it.
 *
 * 提升类 mutation（pin / unpin / accept / unaccept）。
 *
 * 每个 mutation 针对 thread 范围内的某个回复，并在 settle 时刷新 thread 查询，
 * 使提升徽章（`CommentPromotionBadge`）和兄弟节点排序（`orderSiblingsByPromotion`）
 * 从服务器的真实状态重新计算。在 settle 而非仅 success 时失效，意味着过时的 `403`
 * 会将 thread 重新同步到服务器的视图，而非留下一个被错误应用的控件。服务器端的
 * 鉴权关口（`assertCanPromoteInThread`）仍是唯一的授权来源；这些 hook 绝不会重新实现它。
 */
function refreshCommentThreads(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: commentKeys.all() });
}

/**
 * Pin a reply (`kind = PINNED`) within its thread scope.
 * 在某个回复所属的 thread 范围内将其置顶（`kind = PINNED`）。
 */
export function usePinCommentMutation(
  options?: Omit<
    UseMutationOptions<CommentPromotionDTO, Error, PinCommentInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PinCommentInput) => postApi.pin(input),
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      refreshCommentThreads(queryClient);
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/**
 * Remove a `PINNED` promotion from a reply.
 * 从某个回复移除 `PINNED` 提升。
 */
export function useUnpinCommentMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { scopeUnitId: string; commentId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scopeUnitId, commentId }) =>
      postApi.unpin(scopeUnitId, commentId),
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      refreshCommentThreads(queryClient);
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/**
 * Accept a direct reply as an answer (`kind = ACCEPTED_ANSWER`) in a Q&A thread.
 * 在问答 thread 中将某个直接回复采纳为答案（`kind = ACCEPTED_ANSWER`）。
 */
export function useAcceptAnswerMutation(
  options?: Omit<
    UseMutationOptions<CommentPromotionDTO, Error, AcceptAnswerInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AcceptAnswerInput) => postApi.acceptAnswer(input),
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      refreshCommentThreads(queryClient);
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/**
 * Remove an `ACCEPTED_ANSWER` promotion from a reply.
 * 从某个回复移除 `ACCEPTED_ANSWER` 提升。
 */
export function useUnacceptAnswerMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { scopeUnitId: string; commentId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scopeUnitId, commentId }) =>
      postApi.unacceptAnswer(scopeUnitId, commentId),
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      refreshCommentThreads(queryClient);
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

export const postMutations = {
  useCreate: useCreatePostMutation,
  useCreateWiki: useCreateWikiPostMutation,
  useUpdate: useUpdatePostMutation,
  useUpdateWikiContent: useUpdateWikiPostContentMutation,
  useDelete: useDeletePostMutation,
  useSetPublication: useSetPostPublicationMutation,
  useSubmitToRealm: useSubmitPostToRealmMutation,
  useSetState: useSetPostStateMutation,
  usePin: usePinCommentMutation,
  useUnpin: useUnpinCommentMutation,
  useAcceptAnswer: useAcceptAnswerMutation,
  useUnacceptAnswer: useUnacceptAnswerMutation,
};
