/**
 * React Query configurations for Realm queries
 */

import type {
  RealmListQuery,
  RealmMemberListQuery,
  RealmReadQuery,
} from "@rezics/contract";
import { infiniteQueryOptions, queryOptions } from "@tanstack/react-query";
import { realmApi } from "./realm.api";
import { realmKeys } from "./realm.keys";
import type { RealmFilters } from "./realm.types";

type RealmReadQueryInput = Omit<RealmReadQuery, "languages"> & {
  languages?: string | readonly string[];
};
type RealmListQueryInput = Omit<RealmListQuery, "languages"> & {
  languages?: string | readonly string[];
};

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
export const realmDetailQuery = (unitId: string, query?: RealmReadQueryInput) =>
  queryOptions({
    queryKey: realmKeys.detail(unitId, query),
    queryFn: () => realmApi.get(unitId, query),
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

export const realmMembersQuery = (
  realmUnitId: string,
  query?: RealmMemberListQuery,
) =>
  queryOptions({
    queryKey: realmKeys.memberList(realmUnitId, query?.cursor ?? null),
    queryFn: () => realmApi.listMembers(realmUnitId, query),
    staleTime: 1000 * 60 * 2,
  });

export const realmRulePolicyQuery = (realmUnitId: string) =>
  queryOptions({
    queryKey: realmKeys.rules(realmUnitId),
    queryFn: () => realmApi.getRulePolicy(realmUnitId),
    staleTime: 1000 * 60 * 5,
  });

export const realmRuleResolvedQuery = (
  realmUnitId: string,
  language?: string,
  query?: { languages?: string | readonly string[]; appLocale?: string },
) =>
  queryOptions({
    queryKey: realmKeys.ruleResolved(realmUnitId, language, query),
    queryFn: () => realmApi.resolveRule(realmUnitId, language, query),
    staleTime: 1000 * 60 * 5,
  });

/**
 * Combined query options export
 */
export const myRealmsQuery = (query?: RealmListQueryInput) =>
  queryOptions({
    queryKey: realmKeys.mine(query),
    queryFn: () => realmApi.mine(query),
    staleTime: 1000 * 60 * 2,
  });

export const realmsByMemberQuery = (
  userId: string,
  query?: RealmListQueryInput,
) =>
  queryOptions({
    queryKey: realmKeys.byMember(userId, query),
    queryFn: () => realmApi.byMember(userId, query),
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

export const realmTagApplicationsForUnitQuery = (
  realmUnitId: string,
  unitId: string,
) =>
  queryOptions({
    queryKey: realmKeys.tagApplicationsForUnit(realmUnitId, unitId),
    queryFn: () =>
      realmApi.listRealmTagApplicationsForUnit(realmUnitId, unitId),
    enabled: Boolean(realmUnitId && unitId),
    staleTime: 1000 * 60,
  });

export const realmQueries = {
  list: realmListQuery,
  detail: realmDetailQuery,
  search: realmSearchQuery,
  infiniteList: realmInfiniteListQuery,
  mine: myRealmsQuery,
  byMember: realmsByMemberQuery,
  myMembership: myRealmMembershipQuery,
  members: realmMembersQuery,
  rulePolicy: realmRulePolicyQuery,
  ruleResolved: realmRuleResolvedQuery,
  tagContext: realmTagContextQuery,
  tagApplicationsForUnit: realmTagApplicationsForUnitQuery,
};
