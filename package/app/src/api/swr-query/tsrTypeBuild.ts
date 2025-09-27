import { QueryClient, useQuery, type UseQueryOptions, type UseQueryResult } from "@tanstack/react-query";
import { rpcPost } from "./rq.ts";

export const queryClient = new QueryClient();

export type RpcInput = Record<string, unknown> & {
  operation: string;
  parameter?: unknown;
  select?: unknown;
};

export function buildQueryKey(input: RpcInput): readonly [string, unknown?] {
  return input.parameter === undefined
    ? [input.operation] as const
    : [input.operation, input.parameter] as const;
}

export async function rpcFetch<TOut>(input: RpcInput): Promise<TOut> {
  return await rpcPost<TOut>(input);
}

export function useRpcQuery<TOut, TError = Error, TKey extends readonly unknown[] = readonly [string, unknown?]>(
  input: RpcInput,
  options?: Omit<UseQueryOptions<TOut, TError, TOut, TKey>, "queryKey" | "queryFn">,
): UseQueryResult<TOut, TError> {
  const key = buildQueryKey(input) as unknown as TKey;
  return useQuery<TOut, TError, TOut, TKey>({
    queryKey: key,
    queryFn: () => rpcFetch<TOut>(input),
    staleTime: 1000,
    gcTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    retry: 2,
    ...(options as any),
  });
}

export default useRpcQuery;
