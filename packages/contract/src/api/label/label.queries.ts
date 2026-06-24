import { queryOptions } from "@tanstack/react-query";
import { labelApi } from "./label.api";
import { labelKeys } from "./label.keys";

export const labelListQuery = (ids: string[]) =>
  queryOptions({
    queryKey: labelKeys.list(ids),
    queryFn: () => labelApi.list(ids),
    enabled: ids.length > 0,
    staleTime: 1000 * 60 * 10,
  });
