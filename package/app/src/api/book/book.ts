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

// Types
export type {
  BookDTO,
  CreateBookInput,
  UpdateBookInput,
  BookSearchParams,
  BookFormData,
  BookFilters,
  BookSortOption,
  BookView,
} from './book.types';

// Query Keys
export {bookKeys} from './book.keys';

// API Client
export {bookApi} from './book.api';

// Query Configurations
export {
  bookQueries,
  bookListQuery,
  bookDetailQuery,
  bookSearchQuery,
  booksByUserQuery,
  booksByAuthorQuery,
  bookByIsbnQuery,
  bookInfiniteListQuery,
} from './book.queries';

// Mutation Hooks
export {
  bookMutations,
  useCreateBookMutation,
  useUpdateBookMutation,
  useDeleteBookMutation,
} from './book.mutations';
