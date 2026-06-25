import type {
  ContentSearchOptions,
  ContentSearchResult,
  CreateUnitInput,
  UnitListQuery,
  UnitListResponse,
  UnitResponse,
  UserDTO,
} from "@rezics/contract";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type CurrentUserKey = readonly ["eden", "user", "me"];

type UnitListKey = readonly ["eden", "unit", "list", UnitListQuery];

type CreateUnitKey = readonly ["eden", "unit", "create"];

type ContentSearchKey = readonly [
  "eden",
  "meili",
  "content",
  "search",
  ContentSearchOptions,
];

function unitListKey(query: UnitListQuery): UnitListKey {
  return ["eden", "unit", "list", query] as const;
}

function contentSearchKey(options: ContentSearchOptions): ContentSearchKey {
  return ["eden", "meili", "content", "search", options] as const;
}

async function fetchCurrentUser(): Promise<UserDTO> {
  const response = await apiClient.user.me.get();

  return unwrapEdenResponse(response);
}

async function fetchUnitList(
  key: UnitListKey,
): Promise<UnitListResponse> {
  const [, , , query] = key;
  const response = await apiClient.unit.list.get({ query });

  return unwrapEdenResponse(response);
}

async function fetchContentSearch(
  key: ContentSearchKey,
): Promise<ContentSearchResult> {
  const [, , , , options] = key;
  const response = await apiClient.meili.content.search.post(options);

  return unwrapEdenResponse(response);
}

async function createUnit(
  _key: CreateUnitKey,
  { arg }: { arg: CreateUnitInput },
): Promise<UnitResponse> {
  const response = await apiClient.unit.post(arg);

  return unwrapEdenResponse(response);
}

export function useCurrentUserQuery() {
  const result = useSWR<UserDTO>(
    ["eden", "user", "me"] satisfies CurrentUserKey,
    fetchCurrentUser,
    {
      dedupingInterval: 300_000,
      keepPreviousData: true,
    },
  );

  return {
    data: result.data,
    error: result.error,
    isError: Boolean(result.error),
    isFetching: result.isValidating,
    isLoading: result.isLoading,
    refetch: () => {
      void result.mutate();
    },
  };
}

export function useUnitListQuery(query: UnitListQuery, enabled: boolean) {
  const result = useSWR<UnitListResponse>(
    enabled ? unitListKey(query) : null,
    fetchUnitList,
    {
      dedupingInterval: 60_000,
      keepPreviousData: true,
    },
  );

  return {
    data: result.data,
    error: result.error,
    isError: Boolean(result.error),
    isFetching: result.isValidating,
    isLoading: result.isLoading,
    refetch: () => {
      void result.mutate();
    },
  };
}

export function useCreateUnitMutation() {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<
    UnitResponse,
    Error,
    CreateUnitKey,
    CreateUnitInput
  >(
    ["eden", "unit", "create"],
    createUnit,
  );
  const mutateAsync = async (input: CreateUnitInput) => {
    const unit = await mutation.trigger(input);
    await mutate(
      (key) =>
        Array.isArray(key) &&
        key[0] === "eden" &&
        key[1] === "unit" &&
        key[2] === "list",
    );
    return unit;
  };

  return {
    error: mutation.error,
    isPending: mutation.isMutating,
    mutateAsync,
    reset: mutation.reset,
  };
}

export function useUnitContentSearchQuery(
  options: ContentSearchOptions,
  enabled: boolean,
) {
  const result = useSWR<ContentSearchResult>(
    enabled ? contentSearchKey(options) : null,
    fetchContentSearch,
    {
      dedupingInterval: 120_000,
      keepPreviousData: true,
    },
  );

  return {
    data: result.data,
    error: result.error,
    isError: Boolean(result.error),
    isFetching: result.isValidating,
    isLoading: result.isLoading,
    refetch: () => {
      void result.mutate();
    },
  };
}
