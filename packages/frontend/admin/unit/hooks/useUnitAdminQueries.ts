import type {
  ContentSearchOptions,
  ContentSearchResult,
  CreateUnitInput,
  CreateUnitFieldLockInput,
  UnitListQuery,
  UnitListResponse,
  UnitResponse,
  UnitAuthorityRoleKey,
  UnitCollaboratorDTO,
  UnitCollaboratorListResponse,
  UnitFieldLockDTO,
  UnitFieldLockListResponse,
  UserDTO,
} from "@rezics/contract";
import useSWR, { useSWRConfig } from "swr";
import useSWRMutation from "swr/mutation";
import { apiClient, unwrapEdenResponse } from "@/lib/api-client";

type CurrentUserKey = readonly ["eden", "user", "me"];

type UnitListKey = readonly ["eden", "unit", "list", UnitListQuery];

type CreateUnitKey = readonly ["eden", "unit", "create"];

type UnitCollaboratorsKey = readonly [
  "eden",
  "unit",
  "authority",
  "collaborators",
  string,
];

type UnitFieldLocksKey = readonly [
  "eden",
  "unit",
  "authority",
  "field-locks",
  string,
];

type UpsertUnitCollaboratorKey = readonly [
  "eden",
  "unit",
  "authority",
  "collaborators",
  "upsert",
];

type RemoveUnitCollaboratorKey = readonly [
  "eden",
  "unit",
  "authority",
  "collaborators",
  "remove",
];

type UpsertUnitFieldLockKey = readonly [
  "eden",
  "unit",
  "authority",
  "field-locks",
  "upsert",
];

type RemoveUnitFieldLockKey = readonly [
  "eden",
  "unit",
  "authority",
  "field-locks",
  "remove",
];

type RetryHistoryOutboxKey = readonly [
  "eden",
  "admin",
  "history-outbox",
  "retry-failed",
];

type ContentSearchKey = readonly [
  "eden",
  "meili",
  "content",
  "search",
  ContentSearchOptions,
];

export type UpsertUnitCollaboratorVariables = {
  unitId: string;
  userId: string;
  roleKey: UnitAuthorityRoleKey;
};

export type RemoveUnitCollaboratorVariables = {
  unitId: string;
  userId: string;
};

export type UpsertUnitFieldLockVariables = CreateUnitFieldLockInput & {
  unitId: string;
};

export type RemoveUnitFieldLockVariables = {
  unitId: string;
  path: string;
};

export type RetryHistoryOutboxInput = {
  unitId?: string;
};

export type RetryHistoryOutboxResponse = {
  retried: number;
};

function unitListKey(query: UnitListQuery): UnitListKey {
  return ["eden", "unit", "list", query] as const;
}

function contentSearchKey(options: ContentSearchOptions): ContentSearchKey {
  return ["eden", "meili", "content", "search", options] as const;
}

function unitCollaboratorsKey(unitId: string): UnitCollaboratorsKey {
  return ["eden", "unit", "authority", "collaborators", unitId] as const;
}

function unitFieldLocksKey(unitId: string): UnitFieldLocksKey {
  return ["eden", "unit", "authority", "field-locks", unitId] as const;
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

async function fetchUnitCollaborators(
  key: UnitCollaboratorsKey,
): Promise<UnitCollaboratorListResponse> {
  const [, , , , unitId] = key;
  const response = await apiClient.unit({ unitId }).collaborators.get();

  return unwrapEdenResponse(response);
}

async function fetchUnitFieldLocks(
  key: UnitFieldLocksKey,
): Promise<UnitFieldLockListResponse> {
  const [, , , , unitId] = key;
  const response = await apiClient.unit({ unitId })["field-locks"].get();

  return unwrapEdenResponse(response);
}

async function createUnit(
  _key: CreateUnitKey,
  { arg }: { arg: CreateUnitInput },
): Promise<UnitResponse> {
  const response = await apiClient.unit.post(arg);

  return unwrapEdenResponse(response);
}

async function upsertUnitCollaborator(
  _key: UpsertUnitCollaboratorKey,
  { arg }: { arg: UpsertUnitCollaboratorVariables },
): Promise<UnitCollaboratorDTO> {
  const response = await apiClient
    .unit({ unitId: arg.unitId })
    .collaborators({ userId: arg.userId })
    .put({ roleKey: arg.roleKey });

  return unwrapEdenResponse(response);
}

async function removeUnitCollaborator(
  _key: RemoveUnitCollaboratorKey,
  { arg }: { arg: RemoveUnitCollaboratorVariables },
): Promise<{ message: string }> {
  const response = await apiClient
    .unit({ unitId: arg.unitId })
    .collaborators({ userId: arg.userId })
    .delete();

  return unwrapEdenResponse(response);
}

async function upsertUnitFieldLock(
  _key: UpsertUnitFieldLockKey,
  { arg }: { arg: UpsertUnitFieldLockVariables },
): Promise<UnitFieldLockDTO> {
  const response = await apiClient
    .unit({ unitId: arg.unitId })
    ["field-locks"]({ path: arg.path })
    .put({ reason: arg.reason ?? null });

  return unwrapEdenResponse(response);
}

async function removeUnitFieldLock(
  _key: RemoveUnitFieldLockKey,
  { arg }: { arg: RemoveUnitFieldLockVariables },
): Promise<{ message: string }> {
  const response = await apiClient
    .unit({ unitId: arg.unitId })
    ["field-locks"]({ path: arg.path })
    .delete();

  return unwrapEdenResponse(response);
}

async function retryFailedHistoryOutbox(
  _key: RetryHistoryOutboxKey,
  { arg }: { arg: RetryHistoryOutboxInput },
): Promise<RetryHistoryOutboxResponse> {
  const response = await apiClient.admin["history-outbox"][
    "retry-failed"
  ].post(arg);

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

export function useUnitCollaboratorsQuery(unitId: string, enabled = true) {
  const result = useSWR<UnitCollaboratorListResponse>(
    enabled && unitId ? unitCollaboratorsKey(unitId) : null,
    fetchUnitCollaborators,
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
    refetch: () => result.mutate(),
  };
}

export function useUnitFieldLocksQuery(unitId: string, enabled = true) {
  const result = useSWR<UnitFieldLockListResponse>(
    enabled && unitId ? unitFieldLocksKey(unitId) : null,
    fetchUnitFieldLocks,
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
    refetch: () => result.mutate(),
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

export function useUpsertUnitCollaboratorMutation() {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<
    UnitCollaboratorDTO,
    Error,
    UpsertUnitCollaboratorKey,
    UpsertUnitCollaboratorVariables
  >(
    ["eden", "unit", "authority", "collaborators", "upsert"],
    upsertUnitCollaborator,
  );
  const mutateAsync = async (input: UpsertUnitCollaboratorVariables) => {
    const result = await mutation.trigger(input);
    await mutate(unitCollaboratorsKey(input.unitId));
    return result;
  };

  return {
    error: mutation.error,
    isPending: mutation.isMutating,
    mutateAsync,
    reset: mutation.reset,
  };
}

export function useRemoveUnitCollaboratorMutation() {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<
    { message: string },
    Error,
    RemoveUnitCollaboratorKey,
    RemoveUnitCollaboratorVariables
  >(
    ["eden", "unit", "authority", "collaborators", "remove"],
    removeUnitCollaborator,
  );
  const mutateAsync = async (input: RemoveUnitCollaboratorVariables) => {
    const result = await mutation.trigger(input);
    await mutate(unitCollaboratorsKey(input.unitId));
    return result;
  };

  return {
    error: mutation.error,
    isPending: mutation.isMutating,
    mutateAsync,
    reset: mutation.reset,
  };
}

export function useUpsertUnitFieldLockMutation() {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<
    UnitFieldLockDTO,
    Error,
    UpsertUnitFieldLockKey,
    UpsertUnitFieldLockVariables
  >(
    ["eden", "unit", "authority", "field-locks", "upsert"],
    upsertUnitFieldLock,
  );
  const mutateAsync = async (input: UpsertUnitFieldLockVariables) => {
    const result = await mutation.trigger(input);
    await mutate(unitFieldLocksKey(input.unitId));
    return result;
  };

  return {
    error: mutation.error,
    isPending: mutation.isMutating,
    mutateAsync,
    reset: mutation.reset,
  };
}

export function useRemoveUnitFieldLockMutation() {
  const { mutate } = useSWRConfig();
  const mutation = useSWRMutation<
    { message: string },
    Error,
    RemoveUnitFieldLockKey,
    RemoveUnitFieldLockVariables
  >(
    ["eden", "unit", "authority", "field-locks", "remove"],
    removeUnitFieldLock,
  );
  const mutateAsync = async (input: RemoveUnitFieldLockVariables) => {
    const result = await mutation.trigger(input);
    await mutate(unitFieldLocksKey(input.unitId));
    return result;
  };

  return {
    error: mutation.error,
    isPending: mutation.isMutating,
    mutateAsync,
    reset: mutation.reset,
  };
}

export function useRetryFailedHistoryOutboxMutation() {
  const mutation = useSWRMutation<
    RetryHistoryOutboxResponse,
    Error,
    RetryHistoryOutboxKey,
    RetryHistoryOutboxInput
  >(
    ["eden", "admin", "history-outbox", "retry-failed"],
    retryFailedHistoryOutbox,
  );

  return {
    error: mutation.error,
    isPending: mutation.isMutating,
    mutateAsync: mutation.trigger,
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
