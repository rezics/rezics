import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { FeedQuery, FeedResponse } from "./feed.types";

export const feedApi = {
  rows: async (query?: FeedQuery): Promise<FeedResponse> => {
    return apiFetch<FeedResponse>(`/feed/rows${buildQueryString(query)}`);
  },
};
