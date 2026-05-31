/**
 * Post-related TypeScript types and interfaces for the frontend
 *
 * Posts are top-level discussion entities. Reply-tree reads and writes belong
 * to the comment domain; legacy post-reply write fields remain only for
 * compatibility while the server cutover finishes.
 */

import type {
  CreatePostInput,
  PostDTO,
  PostListQuery,
  PostListResponse,
  PostResponse,
  UpdatePostInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  CreatePostInput,
  PostDTO,
  PostListQuery,
  PostListResponse,
  PostResponse,
  UpdatePostInput,
};

/**
 * Extended frontend types
 */
export type PostFormData = Omit<CreatePostInput, never>;

export type PostFilters = Partial<PostListQuery>;

export type PostSortOption = "createdAt" | "updatedAt" | "lastReplyAt";

export type PostView = "thread" | "flat";
