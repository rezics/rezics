/**
 * Post-related TypeScript types and interfaces for the frontend
 *
 * Posts are top-level discussion entities. Reply-tree reads and writes belong
 * to the comment domain.
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

export type CreateRootPostInput = CreatePostInput;

/**
 * Extended frontend types
 */
export type PostFormData = CreateRootPostInput;

export type PostFilters = Partial<PostListQuery>;

export type PostSortOption = "createdAt" | "updatedAt" | "lastReplyAt";

export type PostView = "thread" | "flat";
