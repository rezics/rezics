/**
 * Book-related TypeScript types and interfaces for the frontend
 * 面向前端的书籍相关 TypeScript 类型与接口
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
 * 扩展的前端类型
 */
export type BookFormData = Omit<CreateBookInput, "userId">;

export type BookFilters = Omit<Partial<BookListQuery>, "languages"> & {
  languages?: string | readonly string[];
};

export type BookSortOption = "createdAt" | "updatedAt" | "publishedAt";

export type BookView = "grid" | "list" | "table";
