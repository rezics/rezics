/**
 * Realm-related TypeScript types and interfaces for the frontend
 *
 * Realms are community spaces with membership, content management,
 * and scoped tag classification.
 */

import type {
  AddRealmTagApplicationInput,
  AddRealmUnitInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmDTO,
  RealmListQuery,
  RealmListResponse,
  RealmMemberDTO,
  RealmResponse,
  RealmTagApplicationDTO,
  RealmUnitDTO,
  RemoveRealmTagApplicationInput,
  UpdateMemberRoleInput,
  UpdateRealmInput,
} from "@rezics/contract";

// Re-export contract types
export type {
  AddRealmTagApplicationInput,
  AddRealmUnitInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmDTO,
  RealmListQuery,
  RealmListResponse,
  RealmMemberDTO,
  RealmResponse,
  RealmTagApplicationDTO,
  RealmUnitDTO,
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
