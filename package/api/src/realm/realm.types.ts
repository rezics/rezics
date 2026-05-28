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
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
  RealmDTO,
  RealmListQuery,
  RealmListResponse,
  RealmMemberDTO,
  RealmMembershipMeDTO,
  RealmRuleAcknowledgementDTO,
  RealmResponse,
  RealmTagApplicationDTO,
  UnitRealmDTO,
  RemoveRealmTagApplicationInput,
  UpdateMemberRoleInput,
  UpdateRealmInput,
} from "@rezics/contract";

// Re-export contract types
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
  RealmListQuery,
  RealmListResponse,
  RealmMemberDTO,
  RealmMembershipMeDTO,
  RealmRuleAcknowledgementDTO,
  RealmResponse,
  RealmTagApplicationDTO,
  UnitRealmDTO,
  RemoveRealmTagApplicationInput,
  UpdateMemberRoleInput,
  UpdateRealmInput,
};

/**
 * Extended frontend types
 */
export type RealmFormData = CreateRealmInput;

export type RealmFilters = Partial<RealmListQuery>;

export type RealmSortOption = "createdAt" | "updatedAt" | "memberCount";

export type RealmView = "grid" | "list";
