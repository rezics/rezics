/**
 * Book-related TypeScript types and interfaces for the frontend
 */

import type {
  BookContentStructureItem,
  BookContentStructureResponse,
  BookDTO,
  BookListQuery,
  BookListResponse,
  BookResponse,
  CreateBookInput,
  EditorialPatchSubmission,
  UpdateBookInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  BookContentStructureItem,
  BookContentStructureResponse,
  BookDTO,
  BookListQuery,
  BookListResponse,
  BookResponse,
  CreateBookInput,
  EditorialPatchSubmission,
  UpdateBookInput,
};

/**
 * Extended frontend types
 */
export type BookFormData = Omit<CreateBookInput, "userId">;

export type BookFilters = Partial<BookListQuery>;

export type BookSortOption = "createdAt" | "updatedAt" | "publishedAt";

export type BookView = "grid" | "list" | "table";
