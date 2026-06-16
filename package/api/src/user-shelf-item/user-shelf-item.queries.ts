import type { UserShelfItemsSearchQuery } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { userShelfItemApi } from "./user-shelf-item.api";
import { userShelfItemKeys } from "./user-shelf-item.keys";

export const userShelfItemForUnitQuery = (unitId: string) =>
  queryOptions({
    queryKey: userShelfItemKeys.unit(unitId),
    queryFn: () => userShelfItemApi.getForUnit(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60,
  });

export const userShelfItemSearchMineQuery = (
  query: UserShelfItemsSearchQuery = {},
) =>
  queryOptions({
    queryKey: userShelfItemKeys.searchMine(query),
    queryFn: () => userShelfItemApi.searchMine(query),
    staleTime: 1000 * 30,
  });

export const userShelfItemSearchUserQuery = (
  userId: string,
  query: Omit<UserShelfItemsSearchQuery, "userId"> = {},
) =>
  queryOptions({
    queryKey: userShelfItemKeys.searchUser(userId, query),
    queryFn: () => userShelfItemApi.searchUser(userId, query),
    enabled: !!userId,
    staleTime: 1000 * 30,
  });

export const userShelfItemQueries = {
  forUnit: userShelfItemForUnitQuery,
  searchMine: userShelfItemSearchMineQuery,
  searchUser: userShelfItemSearchUserQuery,
};
