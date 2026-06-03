import type {
  ContentStructureItem,
  ContentStructureResponse,
  CreateSeriesInput,
  SeriesContentIndexDTO,
  SeriesDetailDTO,
  SeriesDiagnosticsDTO,
  SeriesListQuery,
  SeriesListResponse,
  SeriesResponse,
  UpdateSeriesInput,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

function toQueryString(query: Record<string, unknown>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `?${search}` : "";
}

export const seriesApi = {
  detail: async (unitId: string): Promise<SeriesDetailDTO> => {
    return apiFetch<SeriesDetailDTO>(`/series-unit/${unitId}`);
  },

  list: async (query: SeriesListQuery = {}): Promise<SeriesListResponse> => {
    return apiFetch<SeriesListResponse>(
      `/series-unit/list${toQueryString(query)}`,
    );
  },

  listByBody: async (
    query: SeriesListQuery = {},
  ): Promise<SeriesListResponse> => {
    return apiFetch<SeriesListResponse>("/series-unit/list", {
      method: "POST",
      body: JSON.stringify(query),
    });
  },

  create: async (input: CreateSeriesInput): Promise<SeriesResponse> => {
    return apiFetch<SeriesResponse>("/series-unit", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (
    unitId: string,
    input: UpdateSeriesInput,
  ): Promise<SeriesResponse> => {
    return apiFetch<SeriesResponse>(`/series-unit/${unitId}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  updateContentStructure: async (
    unitId: string,
    nodes: ContentStructureItem[],
  ): Promise<ContentStructureResponse> => {
    return apiFetch<ContentStructureResponse>(
      `/series-unit/${unitId}/content-structure`,
      {
        method: "PUT",
        body: JSON.stringify(nodes),
      },
    );
  },

  contentIndex: async (
    unitId: string,
  ): Promise<{ rows: SeriesContentIndexDTO[] }> => {
    return apiFetch<{ rows: SeriesContentIndexDTO[] }>(
      `/series-unit/${unitId}/content-index`,
    );
  },

  diagnostics: async (unitId: string): Promise<SeriesDiagnosticsDTO> => {
    return apiFetch<SeriesDiagnosticsDTO>(`/series-unit/${unitId}/diagnostics`);
  },
};
