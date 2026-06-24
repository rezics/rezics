import type { ActivityListQuery, ActivityListResponse } from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const activityApi = {
  list: async (
    userId: string,
    query?: ActivityListQuery,
  ): Promise<ActivityListResponse> => {
    return apiFetch<ActivityListResponse>(
      `/profile/${encodeURIComponent(userId)}/activity${buildQueryString(query ?? {})}`,
    );
  },
};
