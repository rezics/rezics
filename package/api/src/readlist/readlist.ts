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

// API Client
export { readlistApi } from "./readlist.api";

// Query Keys
export { readlistKeys } from "./readlist.keys";
// Mutation Hooks
export {
  readlistMutations,
  useCreateReadlistMutation,
  useDeleteReadlistMutation,
  useUpdateReadlistMutation,
} from "./readlist.mutations";

// Query Configurations
export {
  readlistDetailQuery,
  readlistInfiniteListQuery,
  readlistListQuery,
  readlistQueries,
  readlistSearchQuery,
  readlistsByUserQuery,
} from "./readlist.queries";
// Types
export type {
  CreateReadlistInput,
  ReadlistDTO,
  ReadlistFilters,
  ReadlistFormData,
  ReadlistSortOption,
  ReadlistView,
  UpdateReadlistInput,
} from "./readlist.types";
