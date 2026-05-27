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

// Re-export contract types used by new realm-tag mutations
export type {
  CastRealmTagApplicationVoteInput,
  CreateRealmTagApplicationInput,
  PatchRealmTagApplicationInput,
  RealmTagApplicationVoteDTO,
  RealmTagContextDTO,
  RealmTagContextReadResponse,
  RealmTagContextUpdateResponse,
  UpdateRealmTagContextInput,
} from "@rezics/contract";
// API Client
export { realmApi } from "./realm.api";
// Query Keys
export { realmKeys } from "./realm.keys";
// Mutation Hooks
export {
  realmMutations,
  useAddRealmTagApplicationMutation,
  useAddUnitRealmMutation,
  useCastRealmTagApplicationVoteMutation,
  useCreateRealmMutation,
  useCreateRealmTagApplicationMutation,
  useDeleteRealmMutation,
  useDeleteRealmTagApplicationMutation,
  useJoinRealmMutation,
  useLeaveRealmMutation,
  useMaterializeRealmTagContextMutation,
  useMuteRealmMutation,
  usePatchRealmTagApplicationMutation,
  useRemoveMemberMutation,
  useRemoveRealmTagApplicationMutation,
  useRemoveUnitRealmMutation,
  useUnmuteRealmMutation,
  useUpdateMemberRoleMutation,
  useUpdateRealmMutation,
  useUpdateRealmTagContextMutation,
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
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmDTO,
  RealmFilters,
  RealmFormData,
  RealmListResponse,
  RealmMemberDTO,
  RealmResponse,
  RealmSortOption,
  RealmTagApplicationDTO,
  UnitRealmDTO,
  RealmView,
  UpdateMemberRoleInput,
  UpdateRealmInput,
} from "./realm.types";
