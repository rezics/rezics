/**
 * Shelf API - Main entry point
 * Shelf replaces Readlist with translation support and item management.
 *
 * File organization:
 * - shelf.types.ts: TypeScript types and interfaces
 * - shelf.keys.ts: React Query key factory
 * - shelf.api.ts: API client functions
 * - shelf.queries.ts: Query configurations
 * - shelf.mutations.ts: Mutation hooks
 * - shelf.ts: Main entry (this file) - unified exports
 */

// API Client
export { shelfApi } from "./shelf.api";

// Query Keys
export { shelfKeys } from "./shelf.keys";
// Mutation Hooks
export {
  shelfMutations,
  useAddShelfItemMutation,
  useCreateShelfMutation,
  useDeleteShelfMutation,
  useRemoveShelfItemMutation,
  useUpdateShelfItemMutation,
  useUpdateShelfMutation,
} from "./shelf.mutations";

// Query Configurations
export {
  shelfDetailQuery,
  shelfInfiniteListQuery,
  shelfListQuery,
  shelfQueries,
  shelvesByUserQuery,
} from "./shelf.queries";
// Types
export type {
  AddShelfItemInput,
  CreateShelfInput,
  ShelfDTO,
  ShelfFilters,
  ShelfFormData,
  ShelfItemDTO,
  ShelfListResponse,
  ShelfResponse,
  ShelfSortOption,
  ShelfView,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "./shelf.types";
