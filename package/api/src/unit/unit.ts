/**
 * Unit API - Main entry point
 * Provides a unified interface for all unit-related operations
 *
 * File organization:
 * - unit.types.ts: TypeScript types and interfaces
 * - unit.keys.ts: React Query key factory
 * - unit.api.ts: API client functions
 * - unit.queries.ts: Query configurations
 * - unit.mutations.ts: Mutation hooks
 * - unit.ts: Main entry (this file) - unified exports
 */

// Types
export type {
  UnitDTO,
  CreateUnitInput,
  UpdateUnitInput,
  UnitFormData,
  UnitFilters,
  UnitSortOption,
  UnitView,
  UnitListQuery,
  UnitResponse,
  UnitListResponse,
  CommentTreeQuery,
  CommentTreeResponse,
  CommentTreeNode,
} from './unit.types';

// Query Keys
export {unitKeys} from './unit.keys';

// API Client
export {unitApi} from './unit.api';

// Query Configurations
export {
  unitQueries,
  unitListQuery,
  unitDetailQuery,
  unitSearchQuery,
  unitsByUserQuery,
  unitInfiniteListQuery,
} from './unit.queries';

// Mutation Hooks
export {
  unitMutations,
  useCreateUnitMutation,
  useUpdateUnitMutation,
  useDeleteUnitMutation,
} from './unit.mutations';
