/**
 * React Query configurations for Tag queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { tagApi } from "./tag.api";
import { tagKeys } from "./tag.keys";
import type { TagFilters } from "./tag.types";

/**
 * Query options for listing/searching tags
 */
export const tagListQuery = (filters?: TagFilters) =>
  queryOptions({
    queryKey: tagKeys.list(filters),
    queryFn: () => tagApi.list(filters),
    staleTime: 1000 * 60 * 5,
  });

/**
 * Query options for getting a single tag by unitId
 */
export const tagDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: tagKeys.detail(unitId),
    queryFn: () => tagApi.get(unitId),
    staleTime: 1000 * 60 * 10,
  });

/**
 * Query options for getting scored tags for a specific unit
 */
export const tagsForUnitQuery = (
  unitId: string,
  filters?: Pick<TagFilters, "minScore" | "limit"> & { language?: string },
) =>
  queryOptions({
    queryKey: tagKeys.forUnit(unitId),
    queryFn: () => tagApi.getForUnit(unitId, filters),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

/**
 * Query options for getting tag context (global tags + realm highlights) for a unit
 */
export const tagContextQuery = (unitId: string) =>
  queryOptions({
    queryKey: tagKeys.context(unitId),
    queryFn: () => tagApi.getTagContext(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 5,
  });

/**
 * Infinite query options for paginated tag list
 */
export const tagInfiniteListQuery = (filters?: Omit<TagFilters, "page">) =>
  infiniteQueryOptions({
    queryKey: tagKeys.list(filters),
    queryFn: ({ pageParam = 1 }) =>
      tagApi.list({ ...filters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const { tags, total } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore =
        tags.length === limit && allPages.length * limit < (total || 0);
      return hasMore ? lastPageParam + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

/**
 * Combined query options export
 */
export const tagQueries = {
  list: tagListQuery,
  detail: tagDetailQuery,
  forUnit: tagsForUnitQuery,
  context: tagContextQuery,
  infiniteList: tagInfiniteListQuery,
};
