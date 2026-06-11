import type {
  ContinueReadingListQuery,
  ContinueReadingListResponse,
  NodeCompletionToggleBody,
  ProgressLibraryListResponse,
  UnitProgressListQuery,
  UnitProgressListResponse,
  UnitProgressRowDTO,
  UnitProgressStatsResponse,
  UnitProgressUpsertBody,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const progressApi = {
  getUnitProgress: async (
    unitId: string,
  ): Promise<UnitProgressRowDTO | null> => {
    return apiFetch<UnitProgressRowDTO | null>(`/me/units/${unitId}/progress`);
  },

  updateUnitProgress: async (
    unitId: string,
    input: UnitProgressUpsertBody,
  ): Promise<UnitProgressRowDTO> => {
    return apiFetch<UnitProgressRowDTO>(`/me/units/${unitId}/progress`, {
      method: "PUT",
      body: JSON.stringify(input),
    });
  },

  listMyProgress: async (
    query?: UnitProgressListQuery,
  ): Promise<UnitProgressListResponse> => {
    const qs = buildQueryString(query ?? {});
    return apiFetch<UnitProgressListResponse>(`/me/progress${qs}`);
  },

  listMyContinueReading: async (
    query?: ContinueReadingListQuery,
  ): Promise<ContinueReadingListResponse> => {
    const qs = buildQueryString(query ?? {});
    return apiFetch<ContinueReadingListResponse>(
      `/me/progress/continue-reading${qs}`,
    );
  },

  listMyProgressLibrary: async (
    query?: UnitProgressListQuery,
  ): Promise<ProgressLibraryListResponse> => {
    const qs = buildQueryString(query ?? {});
    return apiFetch<ProgressLibraryListResponse>(`/me/progress/library${qs}`);
  },

  listMyProgressPage: async (
    query?: UnitProgressListQuery,
  ): Promise<ProgressLibraryListResponse> => {
    const qs = buildQueryString(query ?? {});
    return apiFetch<ProgressLibraryListResponse>(`/me/progress/library${qs}`);
  },

  getUnitProgressStats: async (
    unitId: string,
  ): Promise<UnitProgressStatsResponse> => {
    return apiFetch<UnitProgressStatsResponse>(
      `/units/${unitId}/progress-stats`,
    );
  },

  deleteUnitProgress: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(`/me/units/${unitId}/progress`, {
      method: "DELETE",
    });
  },

  toggleNodeCompletion: async (
    unitId: string,
    input: NodeCompletionToggleBody,
  ): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/me/units/${unitId}/node-completion`,
      {
        method: "POST",
        body: JSON.stringify(input),
      },
    );
  },
};
