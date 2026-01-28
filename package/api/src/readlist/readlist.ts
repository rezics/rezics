/**
 * Readlist API - Main entry point
 * Provides a unified interface for all readlist-related operations
 *
 * File organization:
 * - readlist.types.ts: TypeScript types and interfaces
 * - readlist.keys.ts: React Query key factory
 * - readlist.api.ts: API client functions
 * - readlist.queries.ts: Query configurations
 * - readlist.mutations.ts: Mutation hooks
 * - readlist.ts: Main entry (this file) - unified exports
 */

// Types
export type {
  ReadlistDTO,
  CreateReadlistInput,
  UpdateReadlistInput,
  ReadlistFormData,
  ReadlistFilters,
  ReadlistSortOption,
  ReadlistView,
} from './readlist.types';

// Query Keys
export {readlistKeys} from './readlist.keys';

// API Client
export {readlistApi} from './readlist.api';

// Query Configurations
export {
  readlistQueries,
  readlistListQuery,
  readlistDetailQuery,
  readlistSearchQuery,
  readlistsByUserQuery,
  readlistInfiniteListQuery,
} from './readlist.queries';

// Mutation Hooks
export {
  readlistMutations,
  useCreateReadlistMutation,
  useUpdateReadlistMutation,
  useDeleteReadlistMutation,
} from './readlist.mutations';
