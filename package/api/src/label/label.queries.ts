import { queryOptions } from "@tanstack/react-query";
import { labelApi } from "./label.api";
import { labelKeys } from "./label.keys";

export const labelSearchQueryOptions = (q: string, limit?: number) =>
  queryOptions({
    queryKey: labelKeys.search(q, limit),
    queryFn: () => labelApi.search(q, limit),
    enabled: q.length > 0,
    staleTime: 1000 * 60,
  });

export const labelQueries = {
  search: labelSearchQueryOptions,
};
