/**
 * Realm API client functions
 * Direct API communication layer
 *
 * Realms include membership management, content (UnitRealm),
 * and scoped tag classification (RealmTagApplication).
 */

import type {
  AcknowledgeRealmRuleInput,
  AddRealmTagApplicationInput,
  AddUnitRealmInput,
  CastRealmTagApplicationVoteInput,
  CreateRealmInput,
  CreateRealmTagApplicationInput,
  JoinRealmInput,
  PatchRealmTagApplicationInput,
  RealmExtraAdminReadResponse,
  RealmExtraOkResponse,
  RealmExtraReadResponse,
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
  RealmTagContextDTO,
  RealmTagContextReadResponse,
  RealmTagContextUpdateResponse,
  UnitRealmDTO,
  UpdateMemberRoleInput,
  UpdateRealmInput,
  UpdateRealmRulePolicyInput,
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
  get: async (
    unitId: string,
    query?: { languages?: string | readonly string[] },
  ): Promise<RealmResponse> => {
    return apiFetch<RealmResponse>(
      `/realm/${unitId}${buildQueryString(query)}`,
    );
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

  // ---- Pinboard / Announcements ----

  readPinboard: async (
    realmUnitId: string,
  ): Promise<RealmExtraReadResponse> => {
    return apiFetch<RealmExtraReadResponse>(`/realm/${realmUnitId}/pinboard`);
  },

  readPinboardAdmin: async (
    realmUnitId: string,
  ): Promise<RealmExtraAdminReadResponse> => {
    return apiFetch<RealmExtraAdminReadResponse>(
      `/realm/${realmUnitId}/pinboard/admin`,
    );
  },

  appendPinboard: async (
    realmUnitId: string,
    unitId: string,
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(`/realm/${realmUnitId}/pinboard`, {
      method: "POST",
      body: JSON.stringify({ unitId }),
    });
  },

  reorderPinboard: async (
    realmUnitId: string,
    unitIds: string[],
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmUnitId}/pinboard/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ unitIds }),
      },
    );
  },

  removePinboardEntry: async (
    realmUnitId: string,
    unitId: string,
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmUnitId}/pinboard/${unitId}`,
      { method: "DELETE" },
    );
  },

  readAnnouncements: async (
    realmUnitId: string,
  ): Promise<RealmExtraReadResponse> => {
    return apiFetch<RealmExtraReadResponse>(
      `/realm/${realmUnitId}/announcements`,
    );
  },

  readAnnouncementsAdmin: async (
    realmUnitId: string,
  ): Promise<RealmExtraAdminReadResponse> => {
    return apiFetch<RealmExtraAdminReadResponse>(
      `/realm/${realmUnitId}/announcements/admin`,
    );
  },

  appendAnnouncement: async (
    realmUnitId: string,
    unitId: string,
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmUnitId}/announcements`,
      {
        method: "POST",
        body: JSON.stringify({ unitId }),
      },
    );
  },

  reorderAnnouncements: async (
    realmUnitId: string,
    unitIds: string[],
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmUnitId}/announcements/reorder`,
      {
        method: "POST",
        body: JSON.stringify({ unitIds }),
      },
    );
  },

  removeAnnouncement: async (
    realmUnitId: string,
    unitId: string,
  ): Promise<RealmExtraOkResponse> => {
    return apiFetch<RealmExtraOkResponse>(
      `/realm/${realmUnitId}/announcements/${unitId}`,
      { method: "DELETE" },
    );
  },

  // ---- Membership ----

  /**
   * Get current user's membership in a realm
   */
  getMyMembership: async (
    realmUnitId: string,
  ): Promise<RealmMembershipMeDTO> => {
    return apiFetch<RealmMembershipMeDTO>(`/realm/${realmUnitId}/members/me`);
  },

  listMembers: async (
    realmUnitId: string,
    query?: RealmMemberListQuery,
  ): Promise<RealmMemberListResponse> => {
    return apiFetch<RealmMemberListResponse>(
      `/realm/${realmUnitId}/members${buildQueryString(query)}`,
    );
  },

  /**
   * Acknowledge the current rules for a realm
   */
  acknowledgeRules: async (
    realmUnitId: string,
    input?: AcknowledgeRealmRuleInput,
  ): Promise<RealmRuleAcknowledgementDTO> => {
    return apiFetch<RealmRuleAcknowledgementDTO>(
      `/realm/${realmUnitId}/rules/acknowledgement`,
      {
        method: "POST",
        body: JSON.stringify(input ?? {}),
      },
    );
  },

  getRulePolicy: async (
    realmUnitId: string,
  ): Promise<RealmRuleReferenceDTO> => {
    return apiFetch<RealmRuleReferenceDTO>(`/realm/${realmUnitId}/rules`);
  },

  resolveRule: async (
    realmUnitId: string,
    language?: string,
    query?: { languages?: string | readonly string[] },
  ): Promise<RealmRuleResolvedDTO> => {
    return apiFetch<RealmRuleResolvedDTO>(
      `/realm/${realmUnitId}/rules/resolved${buildQueryString({
        language,
        ...query,
      })}`,
    );
  },

  updateRulePolicy: async (
    realmUnitId: string,
    input: UpdateRealmRulePolicyInput,
  ): Promise<RealmRuleReferenceDTO> => {
    return apiFetch<RealmRuleReferenceDTO>(`/realm/${realmUnitId}/rules`, {
      method: "POST",
      body: JSON.stringify(input),
    });
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

  // ---- Content management (UnitRealm) ----

  /**
   * Add a unit to a realm's content feed
   */
  addUnit: async (
    realmUnitId: string,
    input: AddUnitRealmInput,
  ): Promise<UnitRealmDTO> => {
    return apiFetch<UnitRealmDTO>(`/realm/${realmUnitId}/content`, {
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

  // ---- Scoped tag classification (RealmTagApplication) ----

  /**
   * Add a tag application scoped to a realm
   */
  addTagApplication: async (
    realmUnitId: string,
    input: AddRealmTagApplicationInput,
  ): Promise<RealmTagApplicationDTO> => {
    return apiFetch<RealmTagApplicationDTO>(`/realm/${realmUnitId}/tags`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Remove a tag application from a realm
   */
  removeTagApplication: async (
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
   * Create a RealmTagApplication (creation-as-vote, any realm member).
   * POST /realm-tag-application
   */
  createRealmTagApplication: async (
    input: CreateRealmTagApplicationInput,
  ): Promise<RealmTagApplicationDTO> => {
    return apiFetch<RealmTagApplicationDTO>(`/realm-tag-application`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Pin/unpin or reposition a RealmTagApplication (admin or realm owner).
   * PATCH /realm-tag-application/:realmUnitId/:unitId/:tagUnitId
   */
  patchRealmTagApplication: async (
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
    input: PatchRealmTagApplicationInput,
  ): Promise<RealmTagApplicationDTO> => {
    return apiFetch<RealmTagApplicationDTO>(
      `/realm-tag-application/${encodeURIComponent(realmUnitId)}/${encodeURIComponent(
        unitId,
      )}/${encodeURIComponent(tagUnitId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Delete a RealmTagApplication (admin or realm owner).
   * DELETE /realm-tag-application/:realmUnitId/:unitId/:tagUnitId
   */
  deleteRealmTagApplication: async (
    realmUnitId: string,
    unitId: string,
    tagUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/realm-tag-application/${encodeURIComponent(realmUnitId)}/${encodeURIComponent(
        unitId,
      )}/${encodeURIComponent(tagUnitId)}`,
      { method: "DELETE" },
    );
  },

  /**
   * Cast a RealmTagApplicationVote (membership-checked, retained when member leaves).
   * POST /realm-tag-application-vote
   */
  castRealmTagApplicationVote: async (
    input: CastRealmTagApplicationVoteInput,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/realm-tag-application-vote`, {
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
   * RealmTagApplication row.
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
