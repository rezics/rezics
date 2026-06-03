/**
 * Realm-related TypeScript types and interfaces for the frontend
 *
 * Realms are community spaces with membership, content management,
 * and scoped tag classification.
 */

import type {
  AcknowledgeRealmRuleInput,
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmDTO,
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
  RealmFeedPublicationState,
  RealmListQuery,
  RealmListResponse,
  RealmMemberDTO,
  RealmMemberListQuery,
  RealmMemberListResponse,
  RealmMembershipMeDTO,
  RealmResponse,
  RealmRuleAcknowledgementDTO,
  RealmRuleReferenceDTO,
  RealmRuleResolvedDTO,
  RealmTagApplicationDTO,
  RemoveRealmTagApplicationInput,
  UnitRealmDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
  UpdateRealmRulePolicyInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  AcknowledgeRealmRuleInput,
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmDTO,
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
  RealmFeedPublicationState,
  RealmListQuery,
  RealmListResponse,
  RealmMemberDTO,
  RealmMemberListQuery,
  RealmMemberListResponse,
  RealmMembershipMeDTO,
  RealmResponse,
  RealmRuleAcknowledgementDTO,
  RealmRuleReferenceDTO,
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
 */
export type RealmFormData = CreateRealmInput;

export type RealmFilters = Partial<RealmListQuery>;

export type RealmSortOption = "createdAt" | "updatedAt" | "memberCount";

export type RealmView = "grid" | "list";
