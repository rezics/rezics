/**
 * Realm API - Main entry point
 * Realms are community spaces with membership, content, and tag classification.
 * Realm API —— 主入口
 * Realm 是带有成员、内容和标签分类的社区空间。
 *
 * File organization:
 * - realm.types.ts: TypeScript types and interfaces
 * - realm.keys.ts: React Query key factory
 * - realm.api.ts: API client functions
 * - realm.queries.ts: Query configurations
 * - realm.mutations.ts: Mutation hooks
 * - realm.ts: Main entry (this file) - unified exports
 * 文件组织：
 * - realm.types.ts：TypeScript 类型和接口
 * - realm.keys.ts：React Query 键工厂
 * - realm.api.ts：API 客户端函数
 * - realm.queries.ts：查询配置
 * - realm.mutations.ts：变更 hooks
 * - realm.ts：主入口（本文件）—— 统一导出
 */

// Re-export contract types used by new realm-tag mutations
// 重新导出新的 realm-tag 变更所用到的 contract 类型
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
// API 客户端
export { realmApi } from "./realm.api";
export { realmDockApi } from "./realm-dock.api";
// Query Keys
// 查询键
export { realmKeys } from "./realm.keys";
export { realmDockKeys } from "./realm-dock.keys";
// Mutation Hooks
// 变更 hooks
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
  useUpdateRealmRulePolicyMutation,
  useUpdateRealmTagContextMutation,
  useWithdrawRealmTagApplicationVoteMutation,
} from "./realm.mutations";
export { useUpdateRealmDockMutation } from "./realm-dock.mutations";
// Query Configurations
// 查询配置
export {
  myRealmMembershipQuery,
  myRealmsQuery,
  realmDetailQuery,
  realmInfiniteListQuery,
  realmListQuery,
  realmMembersQuery,
  realmQueries,
  realmRulePolicyQuery,
  realmRuleResolvedQuery,
  realmSearchQuery,
  realmTagApplicationsForUnitQuery,
  realmTagContextQuery,
} from "./realm.queries";
export { realmDockQuery } from "./realm-dock.queries";
// Types
// 类型
export type {
  AcknowledgeRealmRuleInput,
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CreateRealmInput,
  JoinRealmInput,
  ModerationStatus,
  RealmDTO,
  RealmExtraOkResponse,
  RealmFilters,
  RealmFormData,
  RealmListResponse,
  RealmMemberDTO,
  RealmMemberListQuery,
  RealmMemberListResponse,
  RealmMembershipMeDTO,
  RealmResponse,
  RealmRuleAcknowledgementDTO,
  RealmRuleReferenceDTO,
  RealmRuleResolvedDTO,
  RealmSortOption,
  RealmTagApplicationDTO,
  RealmView,
  UnitRealmDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
  UpdateRealmRulePolicyInput,
} from "./realm.types";
export { realmBySlugQuery, useRealmBySlug } from "./useRealmBySlug";
