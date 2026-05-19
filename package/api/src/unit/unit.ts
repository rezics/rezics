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

// API Client
export { unitApi } from "./unit.api";
export { unitAuthorityApi } from "./authority.api";

// Query Keys
export { unitAuthorityKeys } from "./authority.keys";
export { unitKeys } from "./unit.keys";
// Mutation Hooks
export {
  unitAuthorityMutations,
  useRemoveUnitCollaboratorMutation,
  useRemoveUnitFieldLockMutation,
  useUpsertUnitCollaboratorMutation,
  useUpsertUnitFieldLockMutation,
  type RemoveUnitCollaboratorVariables,
  type RemoveUnitFieldLockVariables,
  type UpsertUnitCollaboratorVariables,
  type UpsertUnitFieldLockVariables,
} from "./authority.mutations";
export {
  unitMutations,
  useCreateUnitMutation,
  useDeleteTranslationMutation,
  useDeleteUnitMutation,
  useUpdateUnitMutation,
  useUpsertTranslationMutation,
} from "./unit.mutations";

// Query Configurations
export {
  unitAuthorityQueries,
  unitCollaboratorsQueryOptions,
  unitFieldLocksQueryOptions,
} from "./authority.queries";
export {
  unitBySlugQuery,
  unitDetailQuery,
  unitInfiniteListQuery,
  unitListQuery,
  unitQueries,
  unitSearchQuery,
  unitsByUserQuery,
} from "./unit.queries";
// Types
export type {
  CreateUnitInput,
  UnitDTO,
  UnitFilters,
  UnitFormData,
  UnitListQuery,
  UnitListResponse,
  UnitResponse,
  UnitSortOption,
  UnitTranslationDTO,
  UnitView,
  UpdateUnitInput,
} from "./unit.types";
