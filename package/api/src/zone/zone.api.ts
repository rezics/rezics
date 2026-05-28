import type { WikiZoneConfig, ZoneDTO, ZoneFilters } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export type CreateZoneInput = {
  slug: string;
  translations: Array<{
    language: string;
    title?: string;
    description?: string;
  }>;
  filters: ZoneFilters;
  template: string;
  styling?: Record<string, unknown>;
  wiki?: WikiZoneConfig | null;
  startsAt?: string;
  endsAt?: string;
};

export type UpdateZoneInput = {
  filters?: ZoneFilters;
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
