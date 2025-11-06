import {queryOptions, infiniteQueryOptions} from '@tanstack/react-query';
import {tagApi} from './tag.api';
import {tagKeys} from './tag.keys';
import type {TagFilters} from './tag.types';

export const tagListQuery = (filters?: TagFilters) =>
  queryOptions({
    queryKey: tagKeys.list(filters),
    queryFn: () => tagApi.list(filters),
    staleTime: 1000 * 60 * 5,
  });

export const tagDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: tagKeys.detail(unitId),
    queryFn: () => tagApi.get(unitId),
    staleTime: 1000 * 60 * 10,
  });

export const tagByNameQuery = (
  name: string,
  type?: string | null,
  domainId?: string,
) =>
  queryOptions({
    queryKey: tagKeys.byName(name, type, domainId),
    queryFn: () => tagApi.getByName(name, type, domainId),
    enabled: !!name,
    staleTime: 1000 * 60 * 5,
  });

export const tagByObjectQuery = (objectId: string) =>
  queryOptions({
    queryKey: tagKeys.byObject(objectId),
    queryFn: () => tagApi.list({objectId}),
    enabled: !!objectId,
    staleTime: 1000 * 60 * 5,
  });

export const tagInfiniteListQuery = (filters?: Omit<TagFilters, 'page'>) =>
  infiniteQueryOptions({
    queryKey: tagKeys.list(filters),
    queryFn: ({pageParam = 1}) => tagApi.list({...filters, page: pageParam}),
    initialPageParam: 1,
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      const {tags, total} = lastPage;
      const limit = filters?.limit || 20;
      const hasMore =
        tags.length === limit && allPages.length * limit < (total || 0);
      return hasMore ? lastPageParam + 1 : undefined;
    },
    staleTime: 1000 * 60 * 5,
  });

export const tagQueries = {
  list: tagListQuery,
  detail: tagDetailQuery,
  byName: tagByNameQuery,
  byObject: tagByObjectQuery,
  infiniteList: tagInfiniteListQuery,
};
