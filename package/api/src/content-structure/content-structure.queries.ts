import { queryOptions } from "@tanstack/react-query";
import { contentStructureApi } from "./content-structure.api";
import { contentStructureKeys } from "./content-structure.keys";

export const contentStructureQuery = (ownerUnitId: string) =>
  queryOptions({
    queryKey: contentStructureKeys.detail(ownerUnitId),
    queryFn: () => contentStructureApi.get(ownerUnitId),
    staleTime: 1000 * 60 * 5,
  });

export const contentStructureQueries = {
  detail: contentStructureQuery,
};
