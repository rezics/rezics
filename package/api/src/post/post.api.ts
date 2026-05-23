/**
 * Post API client functions
 * Direct API communication layer
 *
 * Post replaces Comment + Review as a unified discussion primitive.
 */

import type {
  CreatePostInput,
  EditorialPatchSubmission,
  PostListResponse,
  PostResponse,
  UpdatePostInput,
} from "@rezics/contract";
import { CreationMode, PostKind } from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { PostFilters } from "./post.types";

/**
 * Post API methods
 */
export const postApi = {
  /**
   * List posts with optional filters
   * Supports: targetUnitId, realmUnitId, rootPostUnitId, parentPostUnitId,
   * subtreeRootPostUnitId, authorUserId, kind, mode, maxDepth, sort, start,
   * cursor, limit
   */
  list: async (filters?: PostFilters): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(`/post/list${buildQueryString(filters)}`);
  },

  /**
   * Get single post by unitId
   */
  get: async (unitId: string): Promise<PostResponse> => {
    return apiFetch<PostResponse>(`/post/${unitId}`);
  },

  /**
   * Get posts for a specific target unit (e.g. book)
   */
  getByTarget: async (
    targetUnitId: string,
    filters?: PostFilters,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/post/list${buildQueryString({ targetUnitId, ...filters })}`,
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
   * Get thread (replies under a root post)
   */
  getThread: async (
    rootPostUnitId: string,
    filters?: PostFilters,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/post/list${buildQueryString({ rootPostUnitId, ...filters })}`,
    );
  },

  /**
   * Get descendant subtree under a post within a root thread.
   */
  getSubtree: async (
    rootPostUnitId: string,
    subtreeRootPostUnitId: string,
    filters?: PostFilters,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/post/list${buildQueryString({
        ...filters,
        rootPostUnitId,
        subtreeRootPostUnitId,
      })}`,
    );
  },

  /**
   * Get direct replies to a post
   */
  getReplies: async (
    parentPostUnitId: string,
    filters?: PostFilters,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/post/list${buildQueryString({ parentPostUnitId, ...filters })}`,
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

  /**
   * Create new post
   */
  create: async (input: CreatePostInput): Promise<PostResponse> => {
    return apiFetch<PostResponse>("/post", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  createWiki: async (
    input: Omit<CreatePostInput, "kind" | "creationMode">,
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
    content: UpdatePostInput["content"],
  ): Promise<PostResponse> => {
    return postApi.update(unitId, { patch: { post: { content } } });
  },

  /**
   * Delete post
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/post/${unitId}`, {
      method: "DELETE",
    });
  },
};
