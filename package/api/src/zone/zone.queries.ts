import type { ZoneSectionData } from "@rezics/contract";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { zoneApi } from "./zone.api";
import { zoneKeys } from "./zone.keys";

export const zoneQueryOptions = (
  slug: string,
  languages: readonly string[] = [],
) =>
  queryOptions({
    queryKey: zoneKeys.detail(slug, languages),
    queryFn: () => zoneApi.getBySlug(slug, languages),
    enabled: !!slug,
    staleTime: 1000 * 60 * 10,
  });

export const zonePortalQueryOptions = (
  unitId: string,
  languages: readonly string[] = [],
) =>
  queryOptions({
    queryKey: zoneKeys.portal(unitId, languages),
    queryFn: () => zoneApi.getPortal(unitId, languages),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

export const zoneSectionInfiniteQuery = (
  unitId: string,
  sectionId: string,
  languages: readonly string[] = [],
) =>
  infiniteQueryOptions({
    queryKey: zoneKeys.section(unitId, sectionId, languages),
    queryFn: ({ pageParam }) =>
      zoneApi.getSection(unitId, sectionId, {
        cursor: pageParam ?? undefined,
        languages,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ZoneSectionData) =>
      lastPage.nextCursor ?? undefined,
    enabled: !!unitId && !!sectionId,
    staleTime: 1000 * 60 * 5,
  });

export const zoneQueries = {
  detail: zoneQueryOptions,
  portal: zonePortalQueryOptions,
  sectionInfinite: zoneSectionInfiniteQuery,
};
