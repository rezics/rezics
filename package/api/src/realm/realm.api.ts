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
  CastRealmTagVoteInput,
  CreateRealmInput,
  CreateRealmTagUnitInput,
  JoinRealmInput,
  PatchRealmTagUnitInput,
  RealmListResponse,
  RealmMemberDTO,
  RealmResponse,
  RealmTagContextDTO,
  RealmTagContextReadResponse,
  RealmTagContextUpdateResponse,
  RealmTagUnitDTO,
  RealmUnitDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
  UpdateRealmTagContextInput,
} from "@rezics/contract";
import { authApi } from "../auth/auth.api";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { RealmFilters } from "./realm.types";

/**
 * Realm API methods
 */
export const realmApi = {
  mine: async (): Promise<RealmListResponse> => {
    return apiFetch<RealmListResponse>("/realm/me");
  },

  byMember: async (userId: string): Promise<RealmListResponse> => {
    return apiFetch<RealmListResponse>(`/realm/member/${userId}`);
  },

  // ---- CRUD ----

  /**
   * List realms with optional filters
   * Supports: q, isPublic, isOfficial, userId, language, sort, start, limit
   */
  list: async (filters?: RealmFilters): Promise<RealmListResponse> => {
    return apiFetch<RealmListResponse>(
      `/realm/list${buildQueryString(filters)}`,
    );
  },

  /**
   * Get single realm by unitId
   */
  get: async (unitId: string): Promise<RealmResponse> => {
    return apiFetch<RealmResponse>(`/realm/${unitId}`);
  },

  /**
   * Search realms
   */
  search: async (
    query: string,
    filters?: RealmFilters,
  ): Promise<RealmListResponse> => {
    return apiFetch<RealmListResponse>(
      `/realm/list${buildQueryString({ q: query, ...filters })}`,
    );
  },

  /**
   * Create new realm
   */
  create: async (input: CreateRealmInput): Promise<RealmResponse> => {
    return apiFetch<RealmResponse>("/realm", {
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
    return apiFetch<RealmResponse>(`/realm/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete realm
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/realm/${unitId}`, {
      method: "DELETE",
    });
  },

  // ---- Membership ----

  /**
   * Get current user's membership in a realm
   */
  getMyMembership: async (
    realmUnitId: string,
  ): Promise<RealmMemberDTO | null> => {
    return apiFetch<RealmMemberDTO | null>(`/realm/${realmUnitId}/members/me`);
  },

  /**
   * Join a realm
   */
  join: async (
    realmUnitId: string,
    input?: JoinRealmInput,
  ): Promise<RealmMemberDTO> => {
    return apiFetch<RealmMemberDTO>(`/realm/${realmUnitId}/members`, {
      method: "POST",
      body: JSON.stringify(input ?? {}),
    });
  },

  /**
   * Leave a realm
   */
  mute: async (realmUnitId: string): Promise<{ muted: boolean }> => {
    return apiFetch<{ muted: boolean }>(`/realm/${realmUnitId}/mute`, {
      method: "POST",
    });
  },

  unmute: async (realmUnitId: string): Promise<{ muted: boolean }> => {
    return apiFetch<{ muted: boolean }>(`/realm/${realmUnitId}/unmute`, {
      method: "POST",
    });
  },

  leave: async (realmUnitId: string): Promise<{ message: string }> => {
    const sessionState = await authApi.getSessionState();
    const userId = sessionState.user?.id;
    if (!userId) {
      throw new Error("Cannot leave realm: no active session");
    }
    return apiFetch<{ message: string }>(
      `/realm/${realmUnitId}/members/${userId}`,
      {
        method: "DELETE",
      },
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
    return apiFetch<RealmMemberDTO>(`/realm/${realmUnitId}/members/${userId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Remove a member from a realm
   */
  removeMember: async (
    realmUnitId: string,
    userId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/realm/${realmUnitId}/members/${userId}`,
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
    return apiFetch<RealmUnitDTO>(`/realm/${realmUnitId}/content`, {
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
      `/realm/${realmUnitId}/content/${unitId}`,
      {
        method: "DELETE",
      },
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
    return apiFetch<RealmTagUnitDTO>(`/realm/${realmUnitId}/tags`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Remove a tag-unit association from a realm
   */
  removeTagUnit: async (
    realmUnitId: string,
    tagUnitId: string,
    contentUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/realm/${realmUnitId}/tags/${tagUnitId}/${contentUnitId}`,
      {
        method: "DELETE",
      },
    );
  },

  // ---- New realm-tag endpoints (creation-as-vote, pin/position, vote) ----

  /**
   * Create a RealmTagUnit (creation-as-vote, any realm member).
   * POST /realm-tag-units
   */
  createRealmTagUnit: async (
    input: CreateRealmTagUnitInput,
  ): Promise<RealmTagUnitDTO> => {
    return apiFetch<RealmTagUnitDTO>(`/realm-tag-units`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Pin/unpin or reposition a RealmTagUnit (admin or realm owner).
   * PATCH /realm-tag-units/:realmUnitId/:unitId/:tagUnitId
   */
  patchRealmTagUnit: async (
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
    input: PatchRealmTagUnitInput,
  ): Promise<RealmTagUnitDTO> => {
    return apiFetch<RealmTagUnitDTO>(
      `/realm-tag-units/${encodeURIComponent(realmUnitId)}/${encodeURIComponent(
        unitId,
      )}/${encodeURIComponent(tagUnitId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Delete a RealmTagUnit (admin or realm owner).
   * DELETE /realm-tag-units/:realmUnitId/:unitId/:tagUnitId
   */
  deleteRealmTagUnit: async (
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/realm-tag-units/${encodeURIComponent(realmUnitId)}/${encodeURIComponent(
        unitId,
      )}/${encodeURIComponent(tagUnitId)}`,
      { method: "DELETE" },
    );
  },

  /**
   * Cast a RealmTagVote (membership-checked, retained when member leaves).
   * POST /realm-tag-votes
   */
  castRealmTagVote: async (
    input: CastRealmTagVoteInput,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/realm-tag-votes`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  // ---- Realm-tag interpretation contexts ----

  /**
   * Read the pair-level interpretation context for a realm and global tag.
   * GET /realm-tag-context/:realmUnitId/:tagUnitId
   */
  getRealmTagContext: async (
    realmUnitId: string,
    tagUnitId: string,
  ): Promise<RealmTagContextReadResponse> => {
    return apiFetch<RealmTagContextReadResponse>(
      `/realm-tag-context/${encodeURIComponent(
        realmUnitId,
      )}/${encodeURIComponent(tagUnitId)}`,
    );
  },

  /**
   * Upsert/update the pair-level context metadata. This does not create any
   * RealmTagUnit application row.
   * PUT /realm-tag-context/:realmUnitId/:tagUnitId
   */
  updateRealmTagContext: async (
    realmUnitId: string,
    tagUnitId: string,
    input: UpdateRealmTagContextInput,
  ): Promise<RealmTagContextUpdateResponse> => {
    return apiFetch<RealmTagContextUpdateResponse>(
      `/realm-tag-context/${encodeURIComponent(
        realmUnitId,
      )}/${encodeURIComponent(tagUnitId)}`,
      {
        method: "PUT",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Idempotently materialize the pair-level context content Unit.
   * POST /realm-tag-context/:realmUnitId/:tagUnitId/materialize
   */
  materializeRealmTagContext: async (
    realmUnitId: string,
    tagUnitId: string,
  ): Promise<RealmTagContextDTO> => {
    return apiFetch<RealmTagContextDTO>(
      `/realm-tag-context/${encodeURIComponent(
        realmUnitId,
      )}/${encodeURIComponent(tagUnitId)}/materialize`,
      { method: "POST" },
    );
  },
};
