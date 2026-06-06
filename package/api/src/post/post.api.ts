/**
 * Post API client functions
 * Direct API communication layer
 *
 * Post API client functions for top-level discussion entities.
 */

import type {
  AcceptAnswerInput,
  CommentPromotionDTO,
  EditorialPatchSubmission,
  PinCommentInput,
  PostListResponse,
  PostModerationOverlayRequest,
  PostModerationOverlayResponse,
  PostResponse,
  SetPostPublicationInput,
  SetPostStateInput,
  SubmitPostToRealmInput,
  UpdatePostInput,
} from "@rezics/contract";
import { CreationMode, PostKind } from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { CreateRootPostInput, PostFilters } from "./post.types";

function normalizeOptionalId(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function normalizeCreatePostInput(
  input: CreateRootPostInput,
): CreateRootPostInput {
  const normalized = { ...input };
  const targetUnitId = normalizeOptionalId(input.targetUnitId);
  const variantUnitId = normalizeOptionalId(input.variantUnitId);

  if (targetUnitId) normalized.targetUnitId = targetUnitId;
  else delete normalized.targetUnitId;

  if (variantUnitId) normalized.variantUnitId = variantUnitId;
  else delete normalized.variantUnitId;

  return normalized;
}

/**
 * Post API methods
 */
export const postApi = {
  /**
   * List top-level posts with optional filters.
   */
  list: async (filters?: PostFilters): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(`/post/list${buildQueryString(filters)}`);
  },

  /**
   * Get single post by unitId
   */
  get: async (
    unitId: string,
    query?: { languages?: string | readonly string[] },
  ): Promise<PostResponse> => {
    return apiFetch<PostResponse>(`/post/${unitId}${buildQueryString(query)}`);
  },

  /**
   * Get posts for a specific target unit (e.g. book)
   */
  getByTarget: async (
    targetUnitId: string,
    filters?: Omit<PostFilters, "targetUnitId">,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/post/list${buildQueryString({ targetUnitId, ...filters })}`,
    );
  },

  /**
   * Get posts that mention an exact selected VARIANT context.
   */
  getByVariant: async (
    variantUnitId: string,
    filters?: Omit<PostFilters, "variantUnitId">,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/post/list${buildQueryString({ variantUnitId, ...filters })}`,
    );
  },

  /**
   * Get posts by author
   */
  getByAuthor: async (
    authorUserId: string,
    filters?: PostFilters,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/post/list${buildQueryString({ authorUserId, ...filters })}`,
    );
  },

  /**
   * Get posts within a realm
   */
  getByRealm: async (
    realmUnitId: string,
    filters?: PostFilters,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/post/list${buildQueryString({ realmUnitId, ...filters })}`,
    );
  },

  listWiki: async (filters?: Omit<PostFilters, "kind">) => {
    return postApi.list({ ...filters, kind: PostKind.WIKI });
  },

  getWikiByTarget: async (
    targetUnitId: string,
    filters?: Omit<PostFilters, "kind" | "targetUnitId">,
  ): Promise<PostListResponse> => {
    return postApi.listWiki({ ...filters, targetUnitId });
  },

  getWikiByRealm: async (
    realmUnitId: string,
    filters?: Omit<PostFilters, "kind" | "realmUnitId">,
  ): Promise<PostListResponse> => {
    return postApi.listWiki({ ...filters, realmUnitId });
  },

  getModerationOverlays: async (
    input: PostModerationOverlayRequest,
  ): Promise<PostModerationOverlayResponse> => {
    return apiFetch<PostModerationOverlayResponse>(
      "/post/moderation-overlays",
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Create new post
   */
  create: async (input: CreateRootPostInput): Promise<PostResponse> => {
    return apiFetch<PostResponse>("/post", {
      method: "POST",
      body: JSON.stringify(normalizeCreatePostInput(input)),
    });
  },

  /** Publish a draft post or revert a published post to draft (owner-only). */
  setPublication: async (
    unitId: string,
    input: SetPostPublicationInput,
  ): Promise<PostResponse> => {
    return apiFetch<PostResponse>(`/post/${unitId}/publish`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  submitToRealm: async (
    unitId: string,
    input: SubmitPostToRealmInput,
  ): Promise<PostResponse> => {
    return apiFetch<PostResponse>(`/post/${unitId}/submit-to-realm`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  createWiki: async (
    input: Omit<CreateRootPostInput, "kind" | "creationMode">,
  ): Promise<PostResponse> => {
    return postApi.create({
      ...input,
      kind: PostKind.WIKI,
      creationMode: CreationMode.WIKI,
    });
  },

  /**
   * Update existing post
   */
  update: async (
    unitId: string,
    input: EditorialPatchSubmission,
  ): Promise<PostResponse> => {
    return apiFetch<PostResponse>(`/post/${unitId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  updateWikiContent: async (
    unitId: string,
    input: Pick<UpdatePostInput, "title" | "content" | "language">,
  ): Promise<PostResponse> => {
    return postApi.update(unitId, {
      patch: {
        post: {
          title: input.title,
          content: input.content,
          language: input.language,
        },
      },
    });
  },

  /**
   * Delete post
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/post/${unitId}`, {
      method: "DELETE",
    });
  },

  /**
   * Transition a post's lifecycle state (write-strict; gated by the post's
   * schema transitions server-side).
   */
  setState: async (
    unitId: string,
    input: SetPostStateInput,
  ): Promise<PostResponse> => {
    return apiFetch<PostResponse>(`/post/${unitId}/state`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Pin a reply within its thread (kind = PINNED). */
  pin: async (input: PinCommentInput): Promise<CommentPromotionDTO> => {
    return apiFetch<CommentPromotionDTO>("/post/pins", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Remove a PINNED promotion. */
  unpin: async (
    scopeUnitId: string,
    commentId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/post/pins/${scopeUnitId}/${commentId}`,
      { method: "DELETE" },
    );
  },

  /** Accept a direct reply as an answer (kind = ACCEPTED_ANSWER) in a Q&A thread. */
  acceptAnswer: async (
    input: AcceptAnswerInput,
  ): Promise<CommentPromotionDTO> => {
    return apiFetch<CommentPromotionDTO>("/post/accepted-answers", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /** Remove an ACCEPTED_ANSWER promotion. */
  unacceptAnswer: async (
    scopeUnitId: string,
    commentId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/post/accepted-answers/${scopeUnitId}/${commentId}`,
      { method: "DELETE" },
    );
  },
};
