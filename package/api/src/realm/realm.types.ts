/**
 * Realm-related TypeScript types and interfaces for the frontend
 * 面向前端的 realm 相关 TypeScript 类型与接口
 *
 * Realms are community spaces with membership, content management,
 * and scoped tag classification.
 * realm 是带有成员管理、内容管理及作用域标签分类的社区空间。
 */

import type {
  AcknowledgeRealmRuleInput,
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CreateRealmInput,
  CreateRealmRuleRevisionInput,
  JoinRealmInput,
  ModerationStatus,
  RealmDTO,
  RealmExtraOkResponse,
  RealmListQuery,
  RealmListResponse,
  RealmMemberDTO,
  RealmMemberListQuery,
  RealmMemberListResponse,
  RealmMembershipMeDTO,
  RealmResponse,
  RealmRuleAcknowledgementDTO,
  RealmRulePolicyDTO,
  RealmRuleResolvedDTO,
  RealmTagApplicationDTO,
  RemoveRealmTagApplicationInput,
  UnitRealmDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
  UpdateRealmRulePolicyInput,
} from "@rezics/contract";

// Re-export contract types
// 重新导出 contract 类型
export type {
  AcknowledgeRealmRuleInput,
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CreateRealmInput,
  CreateRealmRuleRevisionInput,
  JoinRealmInput,
  ModerationStatus,
  RealmDTO,
  RealmExtraOkResponse,
  RealmListQuery,
  RealmListResponse,
  RealmMemberDTO,
  RealmMemberListQuery,
  RealmMemberListResponse,
  RealmMembershipMeDTO,
  RealmResponse,
  RealmRuleAcknowledgementDTO,
  RealmRulePolicyDTO,
  RealmRuleResolvedDTO,
  RealmTagApplicationDTO,
  RemoveRealmTagApplicationInput,
  UnitRealmDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
  UpdateRealmRulePolicyInput,
};

/**
 * Extended frontend types
 * 扩展的前端类型
 */
export type RealmFormData = CreateRealmInput;

export type RealmFilters = Omit<Partial<RealmListQuery>, "languages"> & {
  languages?: string | readonly string[];
};

export type RealmSortOption = "createdAt" | "updatedAt" | "memberCount";

export type RealmView = "grid" | "list";
