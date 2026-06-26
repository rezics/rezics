import type { EdenResponse } from "@rezics/contract";
import useSWR, {
  type BareFetcher,
  type Key,
  type SWRConfiguration,
  type SWRResponse,
} from "swr";
import { unwrapEdenResponse } from "@/lib/api-client";

type DisabledSWRKey = null | undefined | false;

type EnabledSWRKey<SWRKey extends Key> = Exclude<
  SWRKey,
  DisabledSWRKey
>;

export type AdminEdenQueryResult<Data, Error = unknown> = {
  data: Data | undefined;
  error: Error | undefined;
  isError: boolean;
  isFetching: boolean;
  isLoading: boolean;
  refetch: () => Promise<Data | undefined>;
};

export type AdminEdenQueryOptions<Data, Error = unknown> = SWRConfiguration<
  Data,
  Error,
  BareFetcher<Data>
>;

export function createEdenFetcher<Data, SWRKey>(
  request: (key: SWRKey) => Promise<EdenResponse<Data>>,
): (key: SWRKey) => Promise<Data> {
  return async (key) => unwrapEdenResponse(await request(key));
}

export function toAdminEdenQueryResult<Data, Error = unknown>(
  query: SWRResponse<Data, Error>,
): AdminEdenQueryResult<Data, Error> {
  return {
    data: query.data,
    error: query.error,
    isError: Boolean(query.error),
    isFetching: query.isValidating,
    isLoading: query.isLoading,
    refetch: () => query.mutate(),
  };
}

export function useAdminEdenQuery<
  Data,
  SWRKey extends Key = Key,
  Error = unknown,
>(
  key: SWRKey,
  fetcher: (key: EnabledSWRKey<SWRKey>) => Promise<Data>,
  options?: AdminEdenQueryOptions<Data, Error>,
): AdminEdenQueryResult<Data, Error> {
  const query = useSWR<Data, Error>(
    key,
    fetcher as BareFetcher<Data>,
    options,
  );

  return toAdminEdenQueryResult(query);
}
