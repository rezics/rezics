import type { DraftListQuery, DraftListResponse } from "@rezics/contract";
import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";

export const draftApi = {
  list: async (query?: DraftListQuery): Promise<DraftListResponse> => {
    return apiFetch<DraftListResponse>(
      `/me/drafts${buildQueryString(query ?? {})}`,
    );
  },
};
