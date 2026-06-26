import type {
  EditorialPatchSubmission,
  UserDTO,
  UserListQuery,
  UserListResponse,
} from "@rezics/contract";
import { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import {
  createEdenFetcher,
  useAdminEdenQuery,
} from "@/admin/shared/eden-swr";
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

const fetchUserList = createEdenFetcher<UserListResponse, UserListKey>((key) => {
  const [, , , , query] = key;
  return apiClient.user.admin.get({ query });
});

const fetchUserSearch = createEdenFetcher<UserListResponse, UserSearchKey>(
  (key) => {
    const [, , , , query] = key;
    return apiClient.meili.users.search.get({ query });
  },
);

const fetchAdminUserDetail = createEdenFetcher<UserDTO, UserAdminDetailKey>(
  (key) => {
    const [, , , , userId] = key;
    return apiClient.user.admin({ userId }).get();
  },
);

async function updateAdminUser(
  key: UserAdminUpdateKey,
  { arg }: { arg: EditorialPatchSubmission },
): Promise<UserDTO> {
  const [, , , , userId] = key;
  const response = await apiClient.user.admin({ userId }).put(arg);

  return unwrapEdenResponse(response);
}

export function useAdminUserListQuery(query: UserListQuery, enabled: boolean) {
  return useAdminEdenQuery(enabled ? userListKey(query) : null, fetchUserList, {
    dedupingInterval: 60_000,
    keepPreviousData: true,
  });
}

export function useAdminUserDetailQuery(userId: string) {
  return useAdminEdenQuery(
    userId ? userAdminDetailKey(userId) : null,
    fetchAdminUserDetail,
    {
      dedupingInterval: 120_000,
      keepPreviousData: true,
    },
  );
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
  return useAdminEdenQuery(
    enabled ? userSearchKey(query) : null,
    fetchUserSearch,
    {
      dedupingInterval: 120_000,
      keepPreviousData: true,
    },
  );
}
