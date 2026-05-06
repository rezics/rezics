/**
 * Book-related TypeScript types and interfaces for the frontend
 */

import type {
  BookContentStructureResponse,
  BookDTO,
  BookListQuery,
  BookListResponse,
  BookResponse,
  CreateBookInput,
  UpdateBookInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  BookContentStructureResponse,
  BookDTO,
  BookListQuery,
  BookListResponse,
  BookResponse,
  CreateBookInput,
  UpdateBookInput,
};

/**
 * Extended frontend types
 */
export type BookFormData = Omit<CreateBookInput, "userId">;

export type BookFilters = Partial<BookListQuery>;

export type BookSortOption = "createdAt" | "updatedAt" | "publishedAt";

export type BookView = "grid" | "list" | "table";
