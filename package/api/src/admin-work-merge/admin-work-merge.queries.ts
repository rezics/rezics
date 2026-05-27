import { queryOptions } from "@tanstack/react-query";
import { adminWorkMergeApi } from "./admin-work-merge.api";
import { adminWorkMergeKeys } from "./admin-work-merge.keys";

export const adminWorkMergeDetailQuery = (operationId: string) =>
  queryOptions({
    queryKey: adminWorkMergeKeys.detail(operationId),
    queryFn: () => adminWorkMergeApi.get(operationId),
    staleTime: 1000 * 30,
    enabled: operationId.length > 0,
  });

export const adminWorkMergeQueries = {
  detail: adminWorkMergeDetailQuery,
};
