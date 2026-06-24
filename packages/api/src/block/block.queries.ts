import { queryOptions } from "@tanstack/react-query";
import { blockApi } from "./block.api";
import { blockKeys } from "./block.keys";

export const blockListQuery = () =>
  queryOptions({
    queryKey: blockKeys.list(),
    queryFn: () => blockApi.list(),
  });

export const blockQueries = {
  list: blockListQuery,
};
