import { queryOptions } from "@tanstack/react-query";
import { apiFetch } from "../react-query/http";

export type EchoKvResponse<T = unknown> = {
  value: T;
};

export type EchoKvKeyListResponse = {
  keys: string[];
};

export const echoKvApi = {
  get: async <T = unknown>(key: string): Promise<EchoKvResponse<T>> => {
    return apiFetch<EchoKvResponse<T>>(`/echokv/${encodeURIComponent(key)}`);
  },

  /**
   * Upsert a value by key.
   *
   * NOTE:
   * For the notice board, the value is a JSON-formatted string,
   * which is parsed on the client side.
   */
  set: async <T = unknown>(
    key: string,
    value: T,
  ): Promise<EchoKvResponse<T>> => {
    return apiFetch<EchoKvResponse<T>>(`/echokv/${encodeURIComponent(key)}`, {
      method: "PUT",
      body: JSON.stringify({ value }),
    });
  },

  /**
   * List all keys in EchoKV, optionally filtered by a search string.
   */
  listKeys: async (search?: string): Promise<EchoKvKeyListResponse> => {
    const query = search?.trim()
      ? `?search=${encodeURIComponent(search.trim())}`
      : "";
    return apiFetch<EchoKvKeyListResponse>(`/echokv${query}`);
  },
};

export function echoKvGetQuery(key: string) {
  return queryOptions({
    queryKey: ["echokv", key],
    queryFn: () => echoKvApi.get(key),
    staleTime: 1000 * 60 * 60 * 2, // 2 hours
  });
}

export function echoKvKeyListQuery(search: string) {
  return queryOptions({
    queryKey: ["echokv-keys", search],
    queryFn: () => echoKvApi.listKeys(search),
    staleTime: 1000 * 60, // 1 hour is overkill; 1 min is enough
  });
}
