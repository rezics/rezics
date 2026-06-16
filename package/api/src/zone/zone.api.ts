import type {
  WikiZoneConfig,
  WikiZoneHomepageData,
  ZoneConfigVersion,
  ZoneDTO,
  ZoneFilters,
  ZonePages,
  ZoneSection,
  ZoneTheme,
} from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export type CreateZoneInput = {
  slug: string;
  translations: Array<{
    language: string;
    title?: string;
    description?: string;
  }>;
  ownerRealmUnitId: string;
  filters: ZoneFilters;
  configVersion?: ZoneConfigVersion;
  pages?: ZonePages | null;
  sections?: ZoneSection[] | null;
  theme?: ZoneTheme | null;
  primaryRealmUnitId?: string | null;
  template: string;
  styling?: Record<string, unknown>;
  wiki?: WikiZoneConfig | null;
  startsAt?: string;
  endsAt?: string;
};

export type UpdateZoneInput = {
  ownerRealmUnitId?: string;
  filters?: ZoneFilters;
  configVersion?: ZoneConfigVersion;
  pages?: ZonePages | null;
  sections?: ZoneSection[] | null;
  theme?: ZoneTheme | null;
  primaryRealmUnitId?: string | null;
  template?: string;
  styling?: Record<string, unknown> | null;
  wiki?: WikiZoneConfig | null;
  startsAt?: string | null;
  endsAt?: string | null;
};

export const zoneApi = {
  getBySlug: async (slug: string): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(`/zone/by-slug/${encodeURIComponent(slug)}`);
  },

  get: async (unitId: string): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(`/zone/${encodeURIComponent(unitId)}`);
  },

  getHomepage: async (
    unitId: string,
    languages?: string[],
  ): Promise<WikiZoneHomepageData> => {
    const query = languages?.length
      ? `?languages=${encodeURIComponent(languages.join(","))}`
      : "";
    return apiFetch<WikiZoneHomepageData>(
      `/zone/${encodeURIComponent(unitId)}/homepage${query}`,
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
