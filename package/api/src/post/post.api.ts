/**
 * Post API client functions
 * Direct API communication layer
 *
 * Post replaces Comment + Review as a unified discussion primitive.
 */

import type {
  CreatePostInput,
  PostListResponse,
  PostResponse,
  UpdatePostInput,
} from "@rezics/contract";
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
   * authorUserId, kindKey, mode, maxDepth, sort, start, cursor, limit
   */
  list: async (filters?: PostFilters): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(`/posts${buildQueryString(filters)}`);
  },

  /**
   * Get single post by unitId
   */
  get: async (unitId: string): Promise<PostResponse> => {
    return apiFetch<PostResponse>(`/posts/${unitId}`);
  },

  /**
   * Get posts for a specific target unit (e.g. book)
   */
  getByTarget: async (
    targetUnitId: string,
    filters?: PostFilters,
  ): Promise<PostListResponse> => {
    return apiFetch<PostListResponse>(
      `/posts${buildQueryString({ targetUnitId, ...filters })}`,
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
      `/posts${buildQueryString({ authorUserId, ...filters })}`,
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
      `/posts${buildQueryString({ rootPostUnitId, ...filters })}`,
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
      `/posts${buildQueryString({ parentPostUnitId, ...filters })}`,
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
      `/posts${buildQueryString({ realmUnitId, ...filters })}`,
    );
  },

  /**
   * Create new post
   */
  create: async (input: CreatePostInput): Promise<PostResponse> => {
    return apiFetch<PostResponse>("/posts", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing post
   */
  update: async (
    unitId: string,
    input: UpdatePostInput,
  ): Promise<PostResponse> => {
    return apiFetch<PostResponse>(`/posts/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete post
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/posts/${unitId}`, {
      method: "DELETE",
    });
  },
};
