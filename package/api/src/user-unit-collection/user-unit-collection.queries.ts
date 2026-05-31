import { queryOptions } from "@tanstack/react-query";
import type { CollectionSearchQuery } from "@rezics/contract";
import { userUnitCollectionApi } from "./user-unit-collection.api";
import { userUnitCollectionKeys } from "./user-unit-collection.keys";

export const userUnitCollectionForUnitQuery = (unitId: string) =>
  queryOptions({
    queryKey: userUnitCollectionKeys.unit(unitId),
    queryFn: () => userUnitCollectionApi.getForUnit(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60,
  });

export const userUnitCollectionSearchMineQuery = (
  query: CollectionSearchQuery = {},
) =>
  queryOptions({
    queryKey: userUnitCollectionKeys.searchMine(query),
    queryFn: () => userUnitCollectionApi.searchMine(query),
    staleTime: 1000 * 30,
  });

export const userUnitCollectionSearchUserQuery = (
  userId: string,
  query: Omit<CollectionSearchQuery, "userId"> = {},
) =>
  queryOptions({
    queryKey: userUnitCollectionKeys.searchUser(userId, query),
    queryFn: () => userUnitCollectionApi.searchUser(userId, query),
    enabled: !!userId,
    staleTime: 1000 * 30,
  });

export const userUnitCollectionQueries = {
  forUnit: userUnitCollectionForUnitQuery,
  searchMine: userUnitCollectionSearchMineQuery,
  searchUser: userUnitCollectionSearchUserQuery,
};
