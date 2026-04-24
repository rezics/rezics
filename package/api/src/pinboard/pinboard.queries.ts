/**
 * React Query configurations for pinboard reads.
 */

import { queryOptions } from "@tanstack/react-query";
import {
  pinboardApi,
  type PinboardDetailQueryInput,
  type PinboardListQueryInput,
} from "./pinboard.api";
import { pinboardKeys } from "./pinboard.keys";

export const pinboardListQueryOptions = (input: PinboardListQueryInput) =>
  queryOptions({
    queryKey: pinboardKeys.list(input),
    queryFn: () => pinboardApi.list(input),
    staleTime: 1000 * 60 * 2,
  });

export const pinboardDetailQueryOptions = (input: PinboardDetailQueryInput) =>
  queryOptions({
    queryKey: pinboardKeys.detail(input),
    queryFn: () => pinboardApi.detail(input),
    staleTime: 1000 * 60 * 5,
  });

export const pinboardQueries = {
  list: pinboardListQueryOptions,
  detail: pinboardDetailQueryOptions,
};
