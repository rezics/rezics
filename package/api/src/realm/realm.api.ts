/**
 * Realm API client functions
 * Direct API communication layer
 *
 * Realms include membership management, content (RealmUnit),
 * and scoped tag classification (RealmTagUnit).
 */

import type {
  AddRealmTagUnitInput,
  AddRealmUnitInput,
  CreateRealmInput,
  JoinRealmInput,
  RealmListResponse,
  RealmMemberDTO,
  RealmResponse,
  RealmTagUnitDTO,
  RealmUnitDTO,
  RemoveRealmTagUnitInput,
  UpdateMemberRoleInput,
  UpdateRealmInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { RealmFilters } from "./realm.types";

/**
 * Realm API methods
 */
export const realmApi = {
  // ---- CRUD ----

  /**
   * List realms with optional filters
   * Supports: q, isPublic, isOfficial, userId, language, sort, start, limit
   */
  list: async (filters?: RealmFilters): Promise<RealmListResponse> => {
    return apiFetch<RealmListResponse>(`/realms${buildQueryString(filters)}`);
  },

  /**
   * Get single realm by unitId
   */
  get: async (unitId: string): Promise<RealmResponse> => {
    return apiFetch<RealmResponse>(`/realms/${unitId}`);
  },

  /**
   * Search realms
   */
  search: async (
    query: string,
    filters?: RealmFilters,
  ): Promise<RealmListResponse> => {
    return apiFetch<RealmListResponse>(
      `/realms${buildQueryString({ q: query, ...filters })}`,
    );
  },

  /**
   * Create new realm
   */
  create: async (input: CreateRealmInput): Promise<RealmResponse> => {
    return apiFetch<RealmResponse>("/realms", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update existing realm
   */
  update: async (
    unitId: string,
    input: UpdateRealmInput,
  ): Promise<RealmResponse> => {
    return apiFetch<RealmResponse>(`/realms/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete realm
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/realms/${unitId}`, {
      method: "DELETE",
    });
  },

  // ---- Membership ----

  /**
   * Join a realm
   */
  join: async (
    realmUnitId: string,
    input?: JoinRealmInput,
  ): Promise<RealmMemberDTO> => {
    return apiFetch<RealmMemberDTO>(`/realms/${realmUnitId}/members`, {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    });
  },

  /**
   * Leave a realm
   */
  leave: async (realmUnitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/realms/${realmUnitId}/members/me`, {
      method: "DELETE",
    });
  },

  /**
   * Get realm members
   */
  getMembers: async (
    realmUnitId: string,
  ): Promise<{ members: RealmMemberDTO[] }> => {
    return apiFetch<{ members: RealmMemberDTO[] }>(
      `/realms/${realmUnitId}/members`,
    );
  },

  /**
   * Update a member's role
   */
  updateMemberRole: async (
    realmUnitId: string,
    userId: string,
    input: UpdateMemberRoleInput,
  ): Promise<RealmMemberDTO> => {
    return apiFetch<RealmMemberDTO>(
      `/realms/${realmUnitId}/members/${userId}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Remove a member from a realm
   */
  removeMember: async (
    realmUnitId: string,
    userId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/realms/${realmUnitId}/members/${userId}`,
      {
        method: "DELETE",
      },
    );
  },

  // ---- Content management (RealmUnit) ----

  /**
   * Add a unit to a realm's content feed
   */
  addUnit: async (
    realmUnitId: string,
    input: AddRealmUnitInput,
  ): Promise<RealmUnitDTO> => {
    return apiFetch<RealmUnitDTO>(`/realms/${realmUnitId}/units`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Remove a unit from a realm's content feed
   */
  removeUnit: async (
    realmUnitId: string,
    unitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/realms/${realmUnitId}/units/${unitId}`,
      {
        method: "DELETE",
      },
    );
  },

  /**
   * Get units in a realm
   */
  getUnits: async (
    realmUnitId: string,
  ): Promise<{ units: RealmUnitDTO[] }> => {
    return apiFetch<{ units: RealmUnitDTO[] }>(
      `/realms/${realmUnitId}/units`,
    );
  },

  // ---- Scoped tag classification (RealmTagUnit) ----

  /**
   * Add a tag-unit association scoped to a realm
   */
  addTagUnit: async (
    realmUnitId: string,
    input: AddRealmTagUnitInput,
  ): Promise<RealmTagUnitDTO> => {
    return apiFetch<RealmTagUnitDTO>(`/realms/${realmUnitId}/tag-units`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Remove a tag-unit association from a realm
   */
  removeTagUnit: async (
    realmUnitId: string,
    input: RemoveRealmTagUnitInput,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/realms/${realmUnitId}/tag-units`, {
      method: "DELETE",
      body: JSON.stringify(input),
    });
  },

  /**
   * Get tag-unit associations for a realm
   */
  getTagUnits: async (
    realmUnitId: string,
  ): Promise<{ tagUnits: RealmTagUnitDTO[] }> => {
    return apiFetch<{ tagUnits: RealmTagUnitDTO[] }>(
      `/realms/${realmUnitId}/tag-units`,
    );
  },
};
