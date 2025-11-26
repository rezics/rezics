import {queryOptions} from '@tanstack/react-query';
import {apiFetch} from '../react-query/http';

export type EchoKvResponse<T = unknown> = {
  value: T;
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
      method: 'PUT',
      body: JSON.stringify({value}),
    });
  },
};

export function echoKvGetQuery(key: string) {
  return queryOptions({
    queryKey: ['echokv', key],
    queryFn: () => echoKvApi.get(key),
    staleTime: 1000 * 60 * 60 * 2, // 2 hours
  });
}
