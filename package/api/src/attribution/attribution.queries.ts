import type { EntityListQuery } from "@rezics/contract";
import { queryOptions } from "@tanstack/react-query";
import { attributionApi } from "./attribution.api";
import { attributionKeys } from "./attribution.keys";

export const entityListQuery = (query?: EntityListQuery) =>
  queryOptions({
    queryKey: attributionKeys.entityList(query),
    queryFn: () => attributionApi.listEntities(query),
    staleTime: 1000 * 60 * 5,
  });

export const entityDetailQuery = (id: string) =>
  queryOptions({
    queryKey: attributionKeys.entityDetail(id),
    queryFn: () => attributionApi.getEntity(id),
    enabled: !!id,
    staleTime: 1000 * 60 * 10,
  });

export const attributionQueries = {
  entityList: entityListQuery,
  entityDetail: entityDetailQuery,
};
