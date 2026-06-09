import type {
  CreateZoneInput,
  UpdateZoneInput,
  ZoneDTO,
  ZonePortalResponse,
  ZoneSectionData,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const zoneApi = {
  getBySlug: async (
    slug: string,
    languages: readonly string[] = [],
  ): Promise<ZoneDTO> => {
    const qs = buildQueryString({
      languages: languages.length ? [...languages] : undefined,
    });
    return apiFetch<ZoneDTO>(`/zone/by-slug/${encodeURIComponent(slug)}${qs}`);
  },

  getPortal: async (
    unitId: string,
    languages: readonly string[] = [],
  ): Promise<ZonePortalResponse> => {
    const qs = buildQueryString({
      languages: languages.length ? [...languages] : undefined,
    });
    return apiFetch<ZonePortalResponse>(
      `/zone/${encodeURIComponent(unitId)}/portal${qs}`,
    );
  },

  getSection: async (
    unitId: string,
    sectionId: string,
    options: { cursor?: string; languages?: readonly string[] } = {},
  ): Promise<ZoneSectionData> => {
    const qs = buildQueryString({
      cursor: options.cursor,
      languages: options.languages?.length ? [...options.languages] : undefined,
    });
    return apiFetch<ZoneSectionData>(
      `/zone/${encodeURIComponent(unitId)}/section/${encodeURIComponent(sectionId)}${qs}`,
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

  remove: async (unitId: string): Promise<{ message: string }> => {
    return apiFetch<{ message: string }>(
      `/zone/${encodeURIComponent(unitId)}`,
      {
        method: "DELETE",
      },
    );
  },
};
