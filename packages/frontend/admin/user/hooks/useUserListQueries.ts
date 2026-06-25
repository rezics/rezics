import type { UserListQuery, UserListResponse } from "@rezics/contract";
import useSWR from "swr";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type UserListKey = readonly [
  "eden",
  "user",
  "admin",
  "list",
  UserListQuery,
];

type UserSearchKey = readonly [
  "eden",
  "meili",
  "users",
  "search",
  UserListQuery,
];

function userListKey(query: UserListQuery): UserListKey {
  return ["eden", "user", "admin", "list", query] as const;
}

function userSearchKey(query: UserListQuery): UserSearchKey {
  return ["eden", "meili", "users", "search", query] as const;
}

async function fetchUserList(
  key: UserListKey,
): Promise<UserListResponse> {
  const [, , , , query] = key;
  const response = await apiClient.user.admin.get({ query });

  return unwrapEdenResponse(response);
}

async function fetchUserSearch(
  key: UserSearchKey,
): Promise<UserListResponse> {
  const [, , , , query] = key;
  const response = await apiClient.meili.users.search.get({ query });

  return unwrapEdenResponse(response);
}

export function useAdminUserListQuery(query: UserListQuery, enabled: boolean) {
  const result = useSWR<UserListResponse>(
    enabled ? userListKey(query) : null,
    fetchUserList,
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

export function useMeiliUserSearchQuery(
  query: UserListQuery,
  enabled: boolean,
) {
  const result = useSWR<UserListResponse>(
    enabled ? userSearchKey(query) : null,
    fetchUserSearch,
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
