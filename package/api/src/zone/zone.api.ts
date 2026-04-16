import type { ZoneDTO } from "@rezics/contract";
import { apiFetch } from "../react-query/http";

export const zoneApi = {
  getBySlug: async (slug: string): Promise<ZoneDTO> => {
    return apiFetch<ZoneDTO>(`/zones/${slug}`);
  },
};
