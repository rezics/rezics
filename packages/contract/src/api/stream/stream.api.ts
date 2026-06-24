import { apiFetch } from "../react-query/http";
import { buildQueryString } from "../utils/buildQuery";
import type { StreamQuery, StreamResponse } from "./stream.types";

export const streamApi = {
  rows: async (query?: StreamQuery): Promise<StreamResponse> => {
    return apiFetch<StreamResponse>(`/stream/rows${buildQueryString(query)}`);
  },
};
