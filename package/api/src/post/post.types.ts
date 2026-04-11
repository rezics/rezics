/**
 * Post-related TypeScript types and interfaces for the frontend
 *
 * Post replaces Comment, Review, Note, Remark as a unified discussion entity.
 * Posts support threading via rootPostUnitId/parentPostUnitId, and kinds via kind.
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
