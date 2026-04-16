/**
 * Book API - Main entry point
 * Provides a unified interface for all book-related operations
 *
 * File organization:
 * - book.types.ts: TypeScript types and interfaces
 * - book.keys.ts: React Query key factory
 * - book.api.ts: API client functions
 * - book.queries.ts: Query configurations
 * - book.mutations.ts: Mutation hooks
 * - book.ts: Main entry (this file) - unified exports
 */

// API Client
export { bookApi } from "./book.api";

// Query Keys
export { bookKeys } from "./book.keys";
// Mutation Hooks
export {
  bookMutations,
  useCreateBookMutation,
  useDeleteBookMutation,
  useUpdateBookMutation,
  useUpdateChapterIndexMutation,
} from "./book.mutations";

// Query Configurations
export {
  bookByIsbnQuery,
  bookChapterIndexQuery,
  bookDetailQuery,
  bookInfiniteListQuery,
  bookListQuery,
  bookQueries,
  bookRatingQuery,
  bookSearchQuery,
  booksByEntityQuery,
  booksByTagsQuery,
  booksByUserQuery,
} from "./book.queries";
// Types
export type {
  BookDTO,
  BookFilters,
  BookFormData,
  BookListResponse,
  BookResponse,
  BookSortOption,
  BookView,
  ChapterIndexResponse,
  CreateBookInput,
  UpdateBookInput,
} from "./book.types";
