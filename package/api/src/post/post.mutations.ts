/**
 * React Query mutations for Post operations
 */

import type {
  AcceptAnswerInput,
  CreatePostInput,
  EditorialPatchSubmission,
  PinPostInput,
  PostPinDTO,
  PostResponse,
  SetPostStateInput,
  UpdatePostInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateForCacheDomain } from "../react-query/cache-coherence";
import { postApi } from "./post.api";
import { postKeys } from "./post.keys";

/**
 * Mutation for creating a post
 */
export function useCreatePostMutation(
  options?: Omit<
    UseMutationOptions<PostResponse, Error, CreatePostInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePostInput) => postApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate lists broadly
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });

      // Invalidate target-specific queries if post is attached to a unit
      if (variables.targetUnitId) {
        queryClient.invalidateQueries({
          queryKey: postKeys.byTargets(variables.targetUnitId),
        });
      }

      for (const realmUnitId of variables.realmUnitIds ?? []) {
        queryClient.invalidateQueries({
          queryKey: postKeys.byRealms(realmUnitId),
        });
      }

      // Invalidate thread/reply queries if this is a reply
      if (variables.parentPostUnitId) {
        queryClient.invalidateQueries({
          queryKey: postKeys.allReplies(variables.parentPostUnitId),
        });
        queryClient.invalidateQueries({
          queryKey: postKeys.detail(variables.parentPostUnitId),
        });

        const rootPostUnitId =
          data.rootPostUnitId ?? variables.parentPostUnitId;
        queryClient.invalidateQueries({
          queryKey: postKeys.threads(rootPostUnitId),
        });
        queryClient.invalidateQueries({
          queryKey: postKeys.detail(rootPostUnitId),
        });
      }

      // Pre-populate detail cache
      queryClient.setQueryData(postKeys.detail(data.unitId), data);

      // A draft create adds to the drafts list / dashboard; route through the
      // draft cache domain so both refresh.
      if (variables.status === "DRAFT") {
        void invalidateForCacheDomain(queryClient, "draft");
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCreateWikiPostMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      Omit<CreatePostInput, "kind" | "creationMode">
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input) => postApi.createWiki(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
      if (variables.targetUnitId) {
        queryClient.invalidateQueries({
          queryKey: postKeys.byTargets(variables.targetUnitId),
        });
      }
      for (const realmUnitId of variables.realmUnitIds ?? []) {
        queryClient.invalidateQueries({
          queryKey: postKeys.byRealms(realmUnitId),
        });
      }
      queryClient.setQueryData(postKeys.detail(data.unitId), data);
      // A draft wiki create surfaces in the drafts list / dashboard.
      if (variables.status === "DRAFT") {
        void invalidateForCacheDomain(queryClient, "draft");
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a post
 */
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
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific post
      queryClient.setQueryData(postKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateWikiPostContentMutation(
  options?: Omit<
    UseMutationOptions<
      PostResponse,
      Error,
      { unitId: string; content: UpdatePostInput["content"] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, content }) =>
      postApi.updateWikiContent(unitId, content),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(postKeys.detail(variables.unitId), data);
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a post
 */
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
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      queryClient.removeQueries({ queryKey: postKeys.detail(unitId) });

      // Invalidate all lists
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Publish a draft post or revert a published post to draft. Routes
 * invalidation through the `draft` cache domain (dashboard + drafts list) and
 * refreshes post lists/detail so the post appears/disappears consistently.
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
    onSuccess: (data, variables, onMutateResult, context) => {
      void invalidateForCacheDomain(queryClient, "draft");
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
      queryClient.setQueryData(postKeys.detail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Transition a post's lifecycle state. The server validates the transition
 * against the post's schema; on success we refresh the post detail (badge
 * rendering) and its thread (a root-post close/reopen changes thread-level
 * affordances), plus lists so bucket filters (active/closed) recompute.
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
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(postKeys.detail(variables.unitId), data);
      const rootPostUnitId = data.rootPostUnitId ?? variables.unitId;
      queryClient.invalidateQueries({
        queryKey: postKeys.threads(rootPostUnitId),
      });
      queryClient.invalidateQueries({ queryKey: postKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Promotion mutations (pin / unpin / accept / unaccept).
 *
 * Each mutation targets a reply within a thread scope and, on settle, refreshes
 * the thread query so promotion badges (`PostPinBadge`) and sibling ordering
 * (`orderSiblingsByPromotion`) recompute from server truth. Invalidating on
 * settle — not just success — means a stale `403` re-syncs the thread to the
 * server's view rather than leaving a falsely-applied control. The server gate
 * (`assertCanPromoteInThread`) remains the single authorization source; these
 * hooks never re-implement it.
 */
function refreshThread(
  queryClient: ReturnType<typeof useQueryClient>,
  scopeUnitId: string,
) {
  queryClient.invalidateQueries({ queryKey: postKeys.threads(scopeUnitId) });
}

/** Pin a reply (`kind = PINNED`) within its thread scope. */
export function usePinPostMutation(
  options?: Omit<
    UseMutationOptions<PostPinDTO, Error, PinPostInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: PinPostInput) => postApi.pin(input),
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      refreshThread(queryClient, variables.scopeUnitId);
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/** Remove a `PINNED` promotion from a reply. */
export function useUnpinPostMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { scopeUnitId: string; postUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scopeUnitId, postUnitId }) =>
      postApi.unpin(scopeUnitId, postUnitId),
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      refreshThread(queryClient, variables.scopeUnitId);
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/** Accept a direct reply as an answer (`kind = ACCEPTED_ANSWER`) in a Q&A thread. */
export function useAcceptAnswerMutation(
  options?: Omit<
    UseMutationOptions<PostPinDTO, Error, AcceptAnswerInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: AcceptAnswerInput) => postApi.acceptAnswer(input),
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      refreshThread(queryClient, variables.scopeUnitId);
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/** Remove an `ACCEPTED_ANSWER` promotion from a reply. */
export function useUnacceptAnswerMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { scopeUnitId: string; postUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scopeUnitId, postUnitId }) =>
      postApi.unacceptAnswer(scopeUnitId, postUnitId),
    ...options,
    onSettled: (data, error, variables, onMutateResult, context) => {
      refreshThread(queryClient, variables.scopeUnitId);
      options?.onSettled?.(data, error, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const postMutations = {
  useCreate: useCreatePostMutation,
  useCreateWiki: useCreateWikiPostMutation,
  useUpdate: useUpdatePostMutation,
  useUpdateWikiContent: useUpdateWikiPostContentMutation,
  useDelete: useDeletePostMutation,
  useSetPublication: useSetPostPublicationMutation,
  useSetState: useSetPostStateMutation,
  usePin: usePinPostMutation,
  useUnpin: useUnpinPostMutation,
  useAcceptAnswer: useAcceptAnswerMutation,
  useUnacceptAnswer: useUnacceptAnswerMutation,
};
