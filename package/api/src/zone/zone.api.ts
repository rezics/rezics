import type {
  CreateZoneInput,
  CreateZonePageInput,
  ReadLanguageGetQueryBase,
  UpdateZoneBoundaryInput,
  UpdateZoneInput,
  UpdateZoneNavInput,
  UpdateZonePageInput,
  UpdateZoneThemeInput,
  ZoneDTO,
  ZoneListQuery,
  ZoneListResponse,
  ZonePortalResponse,
  ZoneSectionData,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

type ZoneReadQueryInput = Omit<ReadLanguageGetQueryBase, "languages"> & {
  languages?: string | readonly string[];
};

function normalizeZoneReadQuery(
  query: ZoneReadQueryInput | readonly string[] = {},
): ZoneReadQueryInput {
  return Array.isArray(query) ? { languages: query } : query;
}

export const zoneApi = {
  mine: async (query?: ZoneListQuery): Promise<ZoneListResponse> => {
    return apiFetch<ZoneListResponse>(`/zone/me${buildQueryString(query)}`);
  },

  byUser: async (
    userId: string,
    query?: ZoneListQuery,
  ): Promise<ZoneListResponse> => {
    return apiFetch<ZoneListResponse>(
      `/zone/user/${encodeURIComponent(userId)}${buildQueryString(query)}`,
    );
  },

  getBySlug: async (
    slug: string,
    query: ZoneReadQueryInput | readonly string[] = {},
  ): Promise<ZoneDTO> => {
    const qs = buildQueryString(normalizeZoneReadQuery(query));
    return apiFetch<ZoneDTO>(`/zone/by-slug/${encodeURIComponent(slug)}${qs}`);
  },

  getPortal: async (
    unitId: string,
    pageSlug: string,
    query: ZoneReadQueryInput | readonly string[] = {},
  ): Promise<ZonePortalResponse> => {
    const qs = buildQueryString(normalizeZoneReadQuery(query));
    return apiFetch<ZonePortalResponse>(
      `/zone/${encodeURIComponent(unitId)}/portal/${encodeURIComponent(pageSlug)}${qs}`,
    );
  },

  getSection: async (
    unitId: string,
    pageId: string,
    sectionId: string,
    options: {
      cursor?: string;
      languages?: readonly string[];
      appLocale?: string;
      dynamicTagUnitIds?: readonly string[];
    } = {},
  ): Promise<ZoneSectionData> => {
    const qs = buildQueryString({
      cursor: options.cursor,
      languages: options.languages?.length ? [...options.languages] : undefined,
      appLocale: options.appLocale,
      dynamicTagUnitIds: options.dynamicTagUnitIds?.length
        ? options.dynamicTagUnitIds.join(",")
        : undefined,
    });
    return apiFetch<ZoneSectionData>(
      `/zone/${encodeURIComponent(unitId)}/page/${encodeURIComponent(pageId)}/section/${encodeURIComponent(sectionId)}${qs}`,
    );
  },

  create: async (input: CreateZoneInput): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>("/zone", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  update: async (unitId: string, input: UpdateZoneInput): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(`/zone/${encodeURIComponent(unitId)}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  updateBoundary: async (
    unitId: string,
    input: UpdateZoneBoundaryInput,
  ): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(`/zone/${encodeURIComponent(unitId)}/boundary`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  updateNav: async (
    unitId: string,
    input: UpdateZoneNavInput,
  ): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(`/zone/${encodeURIComponent(unitId)}/nav`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  updateTheme: async (
    unitId: string,
    input: UpdateZoneThemeInput,
  ): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(`/zone/${encodeURIComponent(unitId)}/theme`, {
      method: "PATCH",
      body: JSON.stringify(input),
    });
  },

  createPage: async (
    unitId: string,
    input: CreateZonePageInput,
  ): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(`/zone/${encodeURIComponent(unitId)}/pages`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  updatePage: async (
    unitId: string,
    pageId: string,
    input: UpdateZonePageInput,
  ): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(
      `/zone/${encodeURIComponent(unitId)}/pages/${encodeURIComponent(pageId)}`,
      {
        method: "PATCH",
        body: JSON.stringify(input),
      },
    );
  },

  deletePage: async (unitId: string, pageId: string): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(
      `/zone/${encodeURIComponent(unitId)}/pages/${encodeURIComponent(pageId)}`,
      { method: "DELETE" },
    );
  },

  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/zone/${encodeURIComponent(unitId)}`,
      {
        method: "DELETE",
      },
    );
  },
};
