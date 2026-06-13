import type { ZoneListQuery, ZoneSectionData } from "@rezics/contract";
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

export const myZonesQuery = (query?: ZoneListQuery) =>
  queryOptions({
    queryKey: zoneKeys.mine(query),
    queryFn: () => zoneApi.mine(query),
    staleTime: 1000 * 60 * 2,
  });

export const zonesByUserQuery = (userId: string, query?: ZoneListQuery) =>
  queryOptions({
    queryKey: zoneKeys.byUser(userId, query),
    queryFn: () => zoneApi.byUser(userId, query),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

export const zonePortalQueryOptions = (
  unitId: string,
  pageSlug: string,
  languages: readonly string[] = [],
) =>
  queryOptions({
    queryKey: zoneKeys.portal(unitId, pageSlug, languages),
    queryFn: () => zoneApi.getPortal(unitId, pageSlug, languages),
    enabled: !!unitId && !!pageSlug,
    staleTime: 1000 * 60 * 5,
  });

export const zoneSectionInfiniteQuery = (
  unitId: string,
  pageId: string,
  sectionId: string,
  languages: readonly string[] = [],
  options: { dynamicTagUnitIds?: readonly string[] } = {},
) =>
  infiniteQueryOptions({
    queryKey: zoneKeys.section(
      unitId,
      pageId,
      sectionId,
      languages,
      options.dynamicTagUnitIds ?? [],
    ),
    queryFn: ({ pageParam }) =>
      zoneApi.getSection(unitId, pageId, sectionId, {
        cursor: pageParam ?? undefined,
        languages,
        dynamicTagUnitIds: options.dynamicTagUnitIds,
      }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage: ZoneSectionData) =>
      lastPage.nextCursor ?? undefined,
    enabled: !!unitId && !!pageId && !!sectionId,
    staleTime: 1000 * 60 * 5,
  });

export const zoneQueries = {
  mine: myZonesQuery,
  byUser: zonesByUserQuery,
  detail: zoneQueryOptions,
  portal: zonePortalQueryOptions,
  sectionInfinite: zoneSectionInfiniteQuery,
};
