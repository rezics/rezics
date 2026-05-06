import type { ZoneDTO } from "@rezics/contract";
import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";
import { zoneKeys } from "./zone.keys";

export const zoneBySlugKeys = {
  bySlug: (zoneSlug: string) =>
    [...zoneKeys.all(), "by-slug", zoneSlug] as const,
};

export function zoneBySlugQuery(zoneSlug: string) {
  return queryOptions({
    queryKey: zoneBySlugKeys.bySlug(zoneSlug),
    queryFn: () =>
      apiFetch<ZoneDTO>(`/zone/by-slug/${encodeURIComponent(zoneSlug)}`),
    enabled: !!zoneSlug,
    staleTime: 1000 * 60 * 10,
  });
}

export function useZoneBySlug(zoneSlug: string) {
  return useQuery(zoneBySlugQuery(zoneSlug));
}
