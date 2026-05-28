/**
 * React Query configurations for Realm queries
 */

import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { realmApi } from "./realm.api";
import { realmKeys } from "./realm.keys";
import type { RealmFilters } from "./realm.types";

/**
 * Query options for listing realms
 */
export const realmListQuery = (filters?: RealmFilters) =>
  queryOptions({
    queryKey: realmKeys.list(filters),
    queryFn: () => realmApi.list(filters),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting a single realm
 */
export const realmDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: realmKeys.detail(unitId),
    queryFn: () => realmApi.get(unitId),
    staleTime: 1000 * 60 * 10, // 10 minutes
  });

/**
 * Query options for searching realms
 */
export const realmSearchQuery = (query: string, filters?: RealmFilters) =>
  queryOptions({
    queryKey: realmKeys.search(query, filters),
    queryFn: () => realmApi.search(query, filters),
    enabled: query.length > 0,
    staleTime: 1000 * 60 * 2, // 2 minutes
  });

/**
 * Infinite query options for paginated realm list
 */
export const realmInfiniteListQuery = (filters?: Omit<RealmFilters, "start">) =>
  infiniteQueryOptions({
    queryKey: realmKeys.list(filters),
    queryFn: ({ pageParam = 0 }) =>
      realmApi.list({ ...filters, start: pageParam }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) => {
      const { realms } = lastPage;
      const limit = filters?.limit || 20;
      const hasMore = realms.length === limit;
      return hasMore ? lastPageParam + limit : undefined;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

/**
 * Query options for getting current user's membership in a realm
 */
export const myRealmMembershipQuery = (realmUnitId: string) =>
  queryOptions({
    queryKey: realmKeys.members(realmUnitId),
    queryFn: () => realmApi.getMyMembership(realmUnitId),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });

export const realmRulePolicyQuery = (realmUnitId: string) =>
  queryOptions({
    queryKey: realmKeys.rules(realmUnitId),
    queryFn: () => realmApi.getRulePolicy(realmUnitId),
    staleTime: 1000 * 60 * 5,
  });

/**
 * Combined query options export
 */
export const myRealmsQuery = () =>
  queryOptions({
    queryKey: realmKeys.mine(),
    queryFn: () => realmApi.mine(),
    staleTime: 1000 * 60 * 2,
  });

export const realmsByMemberQuery = (userId: string) =>
  queryOptions({
    queryKey: realmKeys.byMember(userId),
    queryFn: () => realmApi.byMember(userId),
    enabled: !!userId,
    staleTime: 1000 * 60 * 5,
  });

/**
 * Query options for the pair-level realm tag interpretation context.
 */
export const realmTagContextQuery = (realmUnitId: string, tagUnitId: string) =>
  queryOptions({
    queryKey: realmKeys.tagContext(realmUnitId, tagUnitId),
    queryFn: () => realmApi.getRealmTagContext(realmUnitId, tagUnitId),
    staleTime: 1000 * 60 * 5,
  });

export const realmQueries = {
  list: realmListQuery,
  detail: realmDetailQuery,
  search: realmSearchQuery,
  infiniteList: realmInfiniteListQuery,
  mine: myRealmsQuery,
  byMember: realmsByMemberQuery,
  myMembership: myRealmMembershipQuery,
  rulePolicy: realmRulePolicyQuery,
  tagContext: realmTagContextQuery,
};
