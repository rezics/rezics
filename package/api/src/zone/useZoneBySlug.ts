import type { ZoneDTO } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";
import { zoneKeys } from "./zone.keys";

export const zoneBySlugKeys = {
  bySlug: (slug: string) => [...zoneKeys.all(), "by-slug", slug] as const,
};

export function zoneBySlugQuery(slug: string) {
  return queryOptions({
    queryKey: zoneBySlugKeys.bySlug(slug),
    queryFn: () =>
      apiFetch<ZoneDTO>(`/zone/by-slug/${encodeURIComponent(slug)}`),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });
}

export function useZoneBySlug(slug: string) {
  return useQuery(zoneBySlugQuery(slug));
}
