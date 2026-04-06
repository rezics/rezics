/**
 * Readlist-related TypeScript types and interfaces for the frontend
 */

import type {
  CreateReadlistInput,
  ReadlistDTO,
  ReadlistListQuery,
  UpdateReadlistInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  CreateReadlistInput,
  ReadlistDTO,
  ReadlistListQuery,
  UpdateReadlistInput,
};

/**
 * Extended frontend types
 */
export type ReadlistFormData = Omit<CreateReadlistInput, "userId">;

export type ReadlistFilters = Partial<ReadlistListQuery>;

export type ReadlistSortOption =
  | "createdAt"
  | "updatedAt"
  | "publishedAt"
  | "likeCount"
  | "commentCount"
  | "viewCount";

export type ReadlistView = "grid" | "list" | "table";
