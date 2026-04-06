/**
 * Book API - Main entry point
 * Provides a unified interface for all book-related operations
 *
 * File organization:
 * - Book.types.ts: TypeScript types and interfaces
 * - Book.keys.ts: React Query key factory
 * - Book.api.ts: API client functions
 * - Book.queries.ts: Query configurations
 * - Book.mutations.ts: Mutation hooks
 * - Book.ts: Main entry (this file) - unified exports
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
  bookSearchQuery,
  booksByAuthorQuery,
  booksByUserQuery,
} from "./book.queries";
// Types
export type {
  BookDTO,
  BookFilters,
  BookFormData,
  BookSortOption,
  BookView,
  CreateBookInput,
  UpdateBookInput,
} from "./book.types";
