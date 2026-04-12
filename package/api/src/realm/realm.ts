/**
 * Realm API - Main entry point
 * Realms are community spaces with membership, content, and tag classification.
 *
 * File organization:
 * - realm.types.ts: TypeScript types and interfaces
 * - realm.keys.ts: React Query key factory
 * - realm.api.ts: API client functions
 * - realm.queries.ts: Query configurations
 * - realm.mutations.ts: Mutation hooks
 * - realm.ts: Main entry (this file) - unified exports
 */

// API Client
export { realmApi } from "./realm.api";

// Query Keys
export { realmKeys } from "./realm.keys";
// Mutation Hooks
export {
  realmMutations,
  useAddRealmTagUnitMutation,
  useAddRealmUnitMutation,
  useCreateRealmMutation,
  useDeleteRealmMutation,
  useJoinRealmMutation,
  useLeaveRealmMutation,
  useRemoveMemberMutation,
  useRemoveRealmTagUnitMutation,
  useRemoveRealmUnitMutation,
  useUpdateMemberRoleMutation,
  useUpdateRealmMutation,
} from "./realm.mutations";

// Query Configurations
export {
  realmDetailQuery,
  realmInfiniteListQuery,
  realmListQuery,
  realmQueries,
  realmSearchQuery,
} from "./realm.queries";
// Types
export type {
  AddRealmTagUnitInput,
  AddRealmUnitInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmDTO,
  RealmFilters,
  RealmFormData,
  RealmListResponse,
  RealmMemberDTO,
  RealmResponse,
  RealmSortOption,
  RealmTagUnitDTO,
  RealmUnitDTO,
  RealmView,
  UpdateMemberRoleInput,
  UpdateRealmInput,
} from "./realm.types";
