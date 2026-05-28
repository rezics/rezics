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
  useUpdateRealmRulePolicyMutation,
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
  realmRulePolicyQuery,
  realmRuleResolvedQuery,
  realmSearchQuery,
  realmTagContextQuery,
} from "./realm.queries";
// Types
export type {
  AcknowledgeRealmRuleInput,
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
  RealmDTO,
  RealmFilters,
  RealmFormData,
  RealmListResponse,
  RealmMemberDTO,
  RealmMembershipMeDTO,
  RealmRuleAcknowledgementDTO,
  RealmRuleReferenceDTO,
  RealmRuleResolvedDTO,
  RealmResponse,
  RealmSortOption,
  RealmTagApplicationDTO,
  UnitRealmDTO,
  RealmView,
  UpdateMemberRoleInput,
  UpdateRealmRulePolicyInput,
  UpdateRealmInput,
} from "./realm.types";
