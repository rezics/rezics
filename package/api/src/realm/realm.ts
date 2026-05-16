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
  useCastRealmTagVoteMutation,
  useCreateRealmMutation,
  useCreateRealmTagUnitMutation,
  useDeleteRealmMutation,
  useDeleteRealmTagUnitMutation,
  useJoinRealmMutation,
  useLeaveRealmMutation,
  useMaterializeRealmTagContextMutation,
  useMuteRealmMutation,
  usePatchRealmTagUnitMutation,
  useRemoveMemberMutation,
  useRemoveRealmTagUnitMutation,
  useRemoveRealmUnitMutation,
  useUnmuteRealmMutation,
  useUpdateRealmTagContextMutation,
  useUpdateMemberRoleMutation,
  useUpdateRealmMutation,
} from "./realm.mutations";

// Query Configurations
export {
  myRealmMembershipQuery,
  myRealmsQuery,
  realmDetailQuery,
  realmInfiniteListQuery,
  realmListQuery,
  realmQueries,
  realmSearchQuery,
  realmTagContextQuery,
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

// Re-export contract types used by new realm-tag mutations
export type {
  CastRealmTagVoteInput,
  CreateRealmTagUnitInput,
  PatchRealmTagUnitInput,
  RealmTagContextDTO,
  RealmTagContextReadResponse,
  RealmTagContextUpdateResponse,
  RealmTagVoteDTO,
  UpdateRealmTagContextInput,
} from "@rezics/contract";
