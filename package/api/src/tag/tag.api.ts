/**
 * Tag API client functions
 *
 * Tags are Units (type=TAG) with UnitTranslation labels.
 * Scored tag associations (UnitTag) link tags to content with scores/votes.
 */

import type {
  AttachTagInput,
  BatchTagTranslationResult,
  CastTagVoteInput,
  CreateTagInput,
  CreateUnitTagInput,
  DetachTagInput,
  LowScoreTagsQuery,
  LowScoreTagsResponse,
  PatchUnitTagInput,
  TagVoteDTO,
  UnitTagDTO,
  UpdateTagInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { TagFilters } from "./tag.types";

/**
 * Tag API methods
 */
export const tagApi = {
  /**
   * List scored tags for a unit, or search tags globally
   * Supports: q, language, unitId, minScore, page, limit
   */
  list: async (
    filters?: TagFilters,
  ): Promise<{ tags: UnitTagDTO[]; total: number }> => {
    return apiFetch<{ tags: UnitTagDTO[]; total: number }>(
      `/tag/list${buildQueryString(filters)}`,
    );
  },

  /**
   * Get tag detail by unitId (tag is a Unit with type=TAG)
   */
  get: async (unitId: string): Promise<UnitTagDTO> => {
    return apiFetch<UnitTagDTO>(`/tag/${unitId}`);
  },

  /**
   * Create a tag (requires auth)
   * Input: translations array with language + title
   */
  create: async (input: CreateTagInput): Promise<UnitTagDTO> => {
    return apiFetch<UnitTagDTO>(`/tag`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Update a tag's translations
   */
  update: async (
    unitId: string,
    input: UpdateTagInput,
  ): Promise<UnitTagDTO> => {
    return apiFetch<UnitTagDTO>(`/tag/${unitId}`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  /**
   * Delete a tag
   */
  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/tag/${unitId}`, {
      method: "DELETE",
    });
  },

  /**
   * Attach a tag to a unit (creates scored junction)
   */
  attach: async (input: AttachTagInput): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/tag/attach`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Detach a tag from a unit
   */
  detach: async (input: DetachTagInput): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/tag/detach`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Cast a vote on a tag-unit association (+1 or -1)
   */
  vote: async (input: CastTagVoteInput): Promise<TagVoteDTO> => {
    return apiFetch<TagVoteDTO>(`/tag/vote`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Get tag context (global tags + realm highlights) for a unit
   */
  getTagContext: async (
    unitId: string,
  ): Promise<{
    tags: { tagUnitId: string; score: number; label: string }[];
    realmHighlights: {
      realmUnitId: string;
      realmName: string;
      tags: {
        tagUnitId: string;
        label: string;
        score: number;
        contextUnitId: string | null;
      }[];
    }[];
  }> => {
    return apiFetch(`/tag/for-unit/${unitId}/context`);
  },

  /**
   * Get scored tags for a specific unit
   */
  getForUnit: async (
    unitId: string,
    filters?: Pick<TagFilters, "minScore" | "limit"> & { language?: string },
  ): Promise<{ tags: UnitTagDTO[] }> => {
    return apiFetch<{ tags: UnitTagDTO[] }>(
      `/tag/for-unit/${unitId}${buildQueryString(filters)}`,
    );
  },

  /**
   * Resolve translations for a batch of tag unit IDs in the requested language.
   * Returns `{ [tagUnitId]: { name, slug, description } }`.
   */
  batchTranslations: async (
    tagUnitIds: string[],
    lang: string,
  ): Promise<BatchTagTranslationResult> => {
    if (tagUnitIds.length === 0) return {};
    const params = buildQueryString({ unitIds: tagUnitIds.join(","), lang });
    return apiFetch<BatchTagTranslationResult>(
      `/tag/batch-translations${params}`,
    );
  },

  /**
   * Create a UnitTag (creation-as-vote, idempotent per user).
   * POST /unit-tag
   */
  createUnitTag: async (input: CreateUnitTagInput): Promise<UnitTagDTO> => {
    return apiFetch<UnitTagDTO>(`/unit-tag`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  /**
   * Pin/unpin or reposition a UnitTag (admin or unit owner).
   * PATCH /unit-tag/:unitId/:tagUnitId
   */
  patchUnitTag: async (
    unitId: string,
    tagUnitId: string,
    input: PatchUnitTagInput,
  ): Promise<UnitTagDTO> => {
    return apiFetch<UnitTagDTO>(
      `/unit-tag/${encodeURIComponent(unitId)}/${encodeURIComponent(
        tagUnitId,
      )}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  /**
   * Delete a UnitTag (admin or unit owner).
   * DELETE /unit-tag/:unitId/:tagUnitId
   */
  deleteUnitTag: async (
    unitId: string,
    tagUnitId: string,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/unit-tag/${encodeURIComponent(unitId)}/${encodeURIComponent(
        tagUnitId,
      )}`,
      { method: "DELETE" },
    );
  },

  /**
   * Admin discovery: list UnitTag/RealmTagApplication rows at or below a score threshold.
   * GET /admin/low-score-tag
   */
  listLowScoreTags: async (
    query?: LowScoreTagsQuery,
  ): Promise<LowScoreTagsResponse> => {
    return apiFetch<LowScoreTagsResponse>(
      `/admin/low-score-tag${buildQueryString(query)}`,
    );
  },
};
