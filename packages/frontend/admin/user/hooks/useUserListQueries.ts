import type {
  EditorialPatchSubmission,
  UserDTO,
  UserListQuery,
  UserListResponse,
} from "@rezics/contract";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
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

type UserAdminDetailKey = readonly ["eden", "user", "admin", "detail", string];

type UserAdminUpdateKey = readonly ["eden", "user", "admin", "update", string];

function userListKey(query: UserListQuery): UserListKey {
  return ["eden", "user", "admin", "list", query] as const;
}

function userSearchKey(query: UserListQuery): UserSearchKey {
  return ["eden", "meili", "users", "search", query] as const;
}

function userAdminDetailKey(userId: string): UserAdminDetailKey {
  return ["eden", "user", "admin", "detail", userId] as const;
}

function userAdminUpdateKey(userId: string): UserAdminUpdateKey {
  return ["eden", "user", "admin", "update", userId] as const;
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

async function fetchAdminUserDetail(
  key: UserAdminDetailKey,
): Promise<UserDTO> {
  const [, , , , userId] = key;
  const response = await apiClient.user.admin({ userId }).get();

  return unwrapEdenResponse(response);
}

async function updateAdminUser(
  key: UserAdminUpdateKey,
  { arg }: { arg: EditorialPatchSubmission },
): Promise<UserDTO> {
  const [, , , , userId] = key;
  const response = await apiClient.user.admin({ userId }).put(arg);

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

export function useAdminUserDetailQuery(userId: string) {
  const result = useSWR<UserDTO>(
    userId ? userAdminDetailKey(userId) : null,
    fetchAdminUserDetail,
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
    refetch: () => result.mutate(),
  };
}

export function useAdminUserUpdateMutation(userId: string) {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<
    UserDTO,
    Error,
    UserAdminUpdateKey,
    EditorialPatchSubmission
  >(
    userAdminUpdateKey(userId),
    updateAdminUser,
  );

  const mutateAsync = async (input: EditorialPatchSubmission) => {
    const user = await mutation.trigger(input);
    await mutate(userAdminDetailKey(userId), user, { revalidate: false });
    await mutate(
      (key) =>
        Array.isArray(key) &&
        key[0] === "eden" &&
        key[1] === "user" &&
        key[2] === "admin" &&
        key[3] === "list",
    );
    return user;
  };

  return {
    error: mutation.error,
    isPending: mutation.isMutating,
    mutateAsync,
    reset: mutation.reset,
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
