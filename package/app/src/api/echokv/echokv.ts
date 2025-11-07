import {queryOptions} from '@tanstack/react-query';
import {apiFetch} from '../react-query/http';

export const echoKvApi = {
  get: async (key: string) => {
    return apiFetch<any>(`/echokv/${key}`);
  },
};

export function echoKvGetQuery(key: string) {
  return queryOptions({
    queryKey: ['echokv', key],
    queryFn: () => echoKvApi.get(key),
    staleTime: 1000 * 60 * 60 * 2, // 2 hours
  });
}
