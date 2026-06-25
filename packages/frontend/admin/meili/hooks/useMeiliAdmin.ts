import type {
  MeiliApiMessageResponse,
  MeiliHealthResponse,
  MeiliKey,
  MeiliKeyListResponse,
  MeiliTaskResponse,
} from "@rezics/contract";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type MeiliHealthKey = readonly ["eden", "meili", "admin", "health"];
type MeiliKeysKey = readonly ["eden", "meili", "admin", "keys"];
type MeiliActionKey = readonly [
  "eden",
  "meili",
  "admin",
  "action",
  string,
];
type MeiliDeleteKeyKey = readonly [
  "eden",
  "meili",
  "admin",
  "keys",
  "delete",
];

type MutationCallbacks<Data, Arg = void> = {
  onError?: (error: Error, arg: Arg) => void;
  onSuccess?: (data: Data, arg: Arg) => void;
};

const MEILI_HEALTH_KEY = [
  "eden",
  "meili",
  "admin",
  "health",
] as const satisfies MeiliHealthKey;

const MEILI_KEYS_KEY = [
  "eden",
  "meili",
  "admin",
  "keys",
] as const satisfies MeiliKeysKey;

const MEILI_DELETE_KEY_KEY = [
  "eden",
  "meili",
  "admin",
  "keys",
  "delete",
] as const satisfies MeiliDeleteKeyKey;

function actionKey(action: string): MeiliActionKey {
  return ["eden", "meili", "admin", "action", action] as const;
}

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

async function fetchMeiliHealth(): Promise<MeiliHealthResponse> {
  const response = await apiClient.meili.health.get();
  return unwrapEdenResponse(response);
}

async function fetchMeiliKeys(): Promise<MeiliKeyListResponse> {
  const response = await apiClient.meili.keys.get();
  return unwrapEdenResponse(response);
}

function useMeiliActionMutation<Data>(
  action: string,
  request: () => Promise<Data>,
  options?: MutationCallbacks<Data>,
) {
  const mutation = useSWRMutation<Data, Error, MeiliActionKey, void>(
    actionKey(action),
    () => request(),
  );

  const mutateAsync = async () => {
    try {
      const data = await mutation.trigger();
      options?.onSuccess?.(data, undefined);
      return data;
    } catch (error) {
      const normalized = toError(error);
      options?.onError?.(normalized, undefined);
      throw normalized;
    }
  };

  return {
    error: mutation.error,
    isError: Boolean(mutation.error),
    isPending: mutation.isMutating,
    mutate: () => {
      void mutateAsync().catch(() => undefined);
    },
    mutateAsync,
    reset: mutation.reset,
  };
}

export function useMeiliHealthQuery() {
  const result = useSWR<MeiliHealthResponse>(
    MEILI_HEALTH_KEY,
    fetchMeiliHealth,
    {
      dedupingInterval: 5_000,
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

export function useMeiliKeysQuery() {
  const result = useSWR<MeiliKeyListResponse>(MEILI_KEYS_KEY, fetchMeiliKeys, {
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  return {
    data: result.data,
    error: result.error,
    isError: Boolean(result.error),
    isFetching: result.isValidating,
    isLoading: result.isLoading,
    refetch: () => result.mutate(),
  };
}

export function useMeiliInitContentIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-content", async () => {
    const response = await apiClient.meili.content.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitFeedbacksIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-feedbacks", async () => {
    const response = await apiClient.meili.feedbacks.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitUsersIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-users", async () => {
    const response = await apiClient.meili.users.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitPostsIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-posts", async () => {
    const response = await apiClient.meili.posts.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitPollsIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-polls", async () => {
    const response = await apiClient.meili.polls.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitRealmsIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-realms", async () => {
    const response = await apiClient.meili.realms.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitZonesIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-zones", async () => {
    const response = await apiClient.meili.zones.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitTagsIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-tags", async () => {
    const response = await apiClient.meili.tags.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitLabelsIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-labels", async () => {
    const response = await apiClient.meili.labels.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliInitEntitiesIndexMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("init-entities", async () => {
    const response = await apiClient.meili.entities.init.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncContentMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-content", async () => {
    const response = await apiClient.meili.content.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncFeedbacksMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-feedbacks", async () => {
    const response = await apiClient.meili.feedbacks.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncUsersMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-users", async () => {
    const response = await apiClient.meili.users.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncPostsMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-posts", async () => {
    const response = await apiClient.meili.posts.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncPollsMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-polls", async () => {
    const response = await apiClient.meili.polls.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncRealmsMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-realms", async () => {
    const response = await apiClient.meili.realms.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncZonesMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-zones", async () => {
    const response = await apiClient.meili.zones.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncTagsMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-tags", async () => {
    const response = await apiClient.meili.tags.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncLabelsMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-labels", async () => {
    const response = await apiClient.meili.labels.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliSyncEntitiesMutation(
  options?: MutationCallbacks<MeiliTaskResponse>,
) {
  return useMeiliActionMutation("sync-entities", async () => {
    const response = await apiClient.meili.entities.sync.post();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliDeleteAllContentMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("delete-content", async () => {
    const response = await apiClient.meili.content.deleteAll.get();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliDeleteAllFeedbacksMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("delete-feedbacks", async () => {
    const response = await apiClient.meili.feedbacks.deleteAll.delete();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliDeleteAllUsersMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("delete-users", async () => {
    const response = await apiClient.meili.users.deleteAll.delete();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliDeleteAllPostsMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("delete-posts", async () => {
    const response = await apiClient.meili.posts.deleteAll.delete();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliDeleteAllPollsMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("delete-polls", async () => {
    const response = await apiClient.meili.polls.deleteAll.delete();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliDeleteAllRealmsMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("delete-realms", async () => {
    const response = await apiClient.meili.realms.deleteAll.delete();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliDeleteAllZonesMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("delete-zones", async () => {
    const response = await apiClient.meili.zones.deleteAll.delete();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliDeleteAllEntitiesMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("delete-entities", async () => {
    const response = await apiClient.meili.entities.deleteAll.delete();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliResetAllIndexesMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse>,
) {
  return useMeiliActionMutation("reset-indexes", async () => {
    const response = await apiClient.meili.indexes.resetAll.delete();
    return unwrapEdenResponse(response);
  }, options);
}

export function useMeiliCreateAdminKeyMutation(
  options?: MutationCallbacks<MeiliKey>,
) {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<MeiliKey, Error, MeiliActionKey, void>(
    actionKey("create-admin-key"),
    async () => {
      const response = await apiClient.meili.keys.admin.post();
      return unwrapEdenResponse(response);
    },
  );

  const mutateAsync = async () => {
    try {
      const key = await mutation.trigger();
      await mutate(MEILI_KEYS_KEY);
      options?.onSuccess?.(key, undefined);
      return key;
    } catch (error) {
      const normalized = toError(error);
      options?.onError?.(normalized, undefined);
      throw normalized;
    }
  };

  return {
    error: mutation.error,
    isError: Boolean(mutation.error),
    isPending: mutation.isMutating,
    mutate: () => {
      void mutateAsync().catch(() => undefined);
    },
    mutateAsync,
    reset: mutation.reset,
  };
}

export function useMeiliDeleteKeyMutation(
  options?: MutationCallbacks<MeiliApiMessageResponse, string>,
) {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<
    MeiliApiMessageResponse,
    Error,
    MeiliDeleteKeyKey,
    string
  >(MEILI_DELETE_KEY_KEY, async (_key, { arg }) => {
    const response = await apiClient.meili.keys({ uid: arg }).delete();
    return unwrapEdenResponse(response);
  });

  const mutateAsync = async (uid: string) => {
    try {
      const response = await mutation.trigger(uid);
      await mutate(MEILI_KEYS_KEY);
      options?.onSuccess?.(response, uid);
      return response;
    } catch (error) {
      const normalized = toError(error);
      options?.onError?.(normalized, uid);
      throw normalized;
    }
  };

  return {
    error: mutation.error,
    isError: Boolean(mutation.error),
    isPending: mutation.isMutating,
    mutate: (uid: string) => {
      void mutateAsync(uid).catch(() => undefined);
    },
    mutateAsync,
    reset: mutation.reset,
  };
}
