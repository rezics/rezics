import { queryOptions } from "@tanstack/react-query";
import { linkApi } from "./link.api";
import { linkKeys } from "./link.keys";

export const linkDetailQuery = (unitId: string) =>
  queryOptions({
    queryKey: linkKeys.detail(unitId),
    queryFn: () => linkApi.get(unitId),
    enabled: !!unitId,
    staleTime: 1000 * 60 * 10,
  });

export const linkQueries = {
  detail: linkDetailQuery,
};
