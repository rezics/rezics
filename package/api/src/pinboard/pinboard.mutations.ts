/**
 * React Query mutation hooks for pinboard writes.
 *
 * `reorder`, `pin`, and `unpin` perform optimistic updates on every
 * cached list variant (language + adminView) for the affected board and
 * roll back on error.
 */

import type {
  CreatePinboardEntryBody,
  PinBody,
  PinboardEntryDTO,
  PinboardEntryResponse,
  PinboardKey,
  PinboardListResponse,
  PinboardOkResponse,
  ReorderBody,
  UpdatePinboardEntryBody,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { pinboardApi } from "./pinboard.api";
import { pinboardKeys } from "./pinboard.keys";

type ListQueryEntry = readonly [readonly unknown[], PinboardListResponse | undefined];

interface BoardSnapshot {
  lists: ListQueryEntry[];
}

function snapshotBoard(
  queryClient: ReturnType<typeof useQueryClient>,
  realmUnitId: string,
  pinboardKey: PinboardKey,
): BoardSnapshot {
  const lists = queryClient.getQueriesData<PinboardListResponse>({
    queryKey: pinboardKeys.board(realmUnitId, pinboardKey),
  }) as ListQueryEntry[];
  return { lists };
}

function restoreBoard(
  queryClient: ReturnType<typeof useQueryClient>,
  snapshot: BoardSnapshot,
): void {
  for (const [key, data] of snapshot.lists) {
    queryClient.setQueryData(key, data);
  }
}

function invalidateBoard(
  queryClient: ReturnType<typeof useQueryClient>,
  realmUnitId: string,
  pinboardKey: PinboardKey,
): void {
  queryClient.invalidateQueries({
    queryKey: pinboardKeys.board(realmUnitId, pinboardKey),
  });
}

function mapListVariants(
  queryClient: ReturnType<typeof useQueryClient>,
  realmUnitId: string,
  pinboardKey: PinboardKey,
  updater: (entries: PinboardEntryDTO[]) => PinboardEntryDTO[],
): void {
  queryClient.setQueriesData<PinboardListResponse>(
    { queryKey: pinboardKeys.board(realmUnitId, pinboardKey) },
    (existing) => {
      if (!existing || !Array.isArray(existing.entries)) return existing;
      const nextEntries = updater(existing.entries).map((entry, index) => ({
        ...entry,
        position: index,
      }));
      return { ...existing, entries: nextEntries };
    },
  );
}

// ============================================================
// CREATE
// ============================================================

interface CreatePinboardEntryVariables {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  input: CreatePinboardEntryBody;
}

export function useCreatePinboardEntry(
  options?: Omit<
    UseMutationOptions<
      PinboardEntryResponse,
      Error,
      CreatePinboardEntryVariables
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, pinboardKey, input }) =>
      pinboardApi.create(realmUnitId, pinboardKey, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateBoard(queryClient, variables.realmUnitId, variables.pinboardKey);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

// ============================================================
// UPDATE
// ============================================================

interface UpdatePinboardEntryVariables {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string;
  input: UpdatePinboardEntryBody;
}

export function useUpdatePinboardEntry(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      UpdatePinboardEntryVariables
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ realmUnitId, pinboardKey, unitId, input }) =>
      pinboardApi.update(realmUnitId, pinboardKey, unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateBoard(queryClient, variables.realmUnitId, variables.pinboardKey);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

// ============================================================
// DELETE
// ============================================================

interface DeletePinboardEntryVariables {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string;
}

export function useDeletePinboardEntry(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      DeletePinboardEntryVariables,
      BoardSnapshot
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<
    PinboardOkResponse,
    Error,
    DeletePinboardEntryVariables,
    BoardSnapshot
  >({
    mutationFn: ({ realmUnitId, pinboardKey, unitId }) =>
      pinboardApi.remove(realmUnitId, pinboardKey, unitId),
    ...options,
    onMutate: async (variables, mutationContext) => {
      await queryClient.cancelQueries({
        queryKey: pinboardKeys.board(
          variables.realmUnitId,
          variables.pinboardKey,
        ),
      });
      const snapshot = snapshotBoard(
        queryClient,
        variables.realmUnitId,
        variables.pinboardKey,
      );
      mapListVariants(
        queryClient,
        variables.realmUnitId,
        variables.pinboardKey,
        (entries) => entries.filter((e) => e.unitId !== variables.unitId),
      );
      await options?.onMutate?.(variables, mutationContext);
      return snapshot;
    },
    onError: (error, variables, snapshot, mutationContext) => {
      if (snapshot) restoreBoard(queryClient, snapshot);
      options?.onError?.(error, variables, snapshot, mutationContext);
    },
    onSettled: (data, error, variables, snapshot, mutationContext) => {
      invalidateBoard(queryClient, variables.realmUnitId, variables.pinboardKey);
      options?.onSettled?.(data, error, variables, snapshot, mutationContext);
    },
  });
}

// ============================================================
// PIN (optimistic for already-listed ids; invalidate otherwise)
// ============================================================

interface PinToPinboardVariables {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string;
  input?: PinBody;
}

export function usePinToPinboard(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      PinToPinboardVariables,
      BoardSnapshot
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<
    PinboardOkResponse,
    Error,
    PinToPinboardVariables,
    BoardSnapshot
  >({
    mutationFn: ({ realmUnitId, pinboardKey, unitId, input }) =>
      pinboardApi.pin(realmUnitId, pinboardKey, unitId, input ?? {}),
    ...options,
    onMutate: async (variables, mutationContext) => {
      await queryClient.cancelQueries({
        queryKey: pinboardKeys.board(
          variables.realmUnitId,
          variables.pinboardKey,
        ),
      });
      const snapshot = snapshotBoard(
        queryClient,
        variables.realmUnitId,
        variables.pinboardKey,
      );
      const position = variables.input?.position;
      mapListVariants(
        queryClient,
        variables.realmUnitId,
        variables.pinboardKey,
        (entries) => {
          const existing = entries.find((e) => e.unitId === variables.unitId);
          if (!existing) return entries;
          const without = entries.filter((e) => e.unitId !== variables.unitId);
          const index =
            position === undefined
              ? without.length
              : Math.max(0, Math.min(position, without.length));
          return [...without.slice(0, index), existing, ...without.slice(index)];
        },
      );
      await options?.onMutate?.(variables, mutationContext);
      return snapshot;
    },
    onError: (error, variables, snapshot, mutationContext) => {
      if (snapshot) restoreBoard(queryClient, snapshot);
      options?.onError?.(error, variables, snapshot, mutationContext);
    },
    onSettled: (data, error, variables, snapshot, mutationContext) => {
      invalidateBoard(queryClient, variables.realmUnitId, variables.pinboardKey);
      options?.onSettled?.(data, error, variables, snapshot, mutationContext);
    },
  });
}

// ============================================================
// UNPIN
// ============================================================

interface UnpinFromPinboardVariables {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  unitId: string;
}

export function useUnpinFromPinboard(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      UnpinFromPinboardVariables,
      BoardSnapshot
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<
    PinboardOkResponse,
    Error,
    UnpinFromPinboardVariables,
    BoardSnapshot
  >({
    mutationFn: ({ realmUnitId, pinboardKey, unitId }) =>
      pinboardApi.unpin(realmUnitId, pinboardKey, unitId),
    ...options,
    onMutate: async (variables, mutationContext) => {
      await queryClient.cancelQueries({
        queryKey: pinboardKeys.board(
          variables.realmUnitId,
          variables.pinboardKey,
        ),
      });
      const snapshot = snapshotBoard(
        queryClient,
        variables.realmUnitId,
        variables.pinboardKey,
      );
      mapListVariants(
        queryClient,
        variables.realmUnitId,
        variables.pinboardKey,
        (entries) => entries.filter((e) => e.unitId !== variables.unitId),
      );
      await options?.onMutate?.(variables, mutationContext);
      return snapshot;
    },
    onError: (error, variables, snapshot, mutationContext) => {
      if (snapshot) restoreBoard(queryClient, snapshot);
      options?.onError?.(error, variables, snapshot, mutationContext);
    },
    onSettled: (data, error, variables, snapshot, mutationContext) => {
      invalidateBoard(queryClient, variables.realmUnitId, variables.pinboardKey);
      options?.onSettled?.(data, error, variables, snapshot, mutationContext);
    },
  });
}

// ============================================================
// REORDER (optimistic)
// ============================================================

interface ReorderPinboardVariables {
  realmUnitId: string;
  pinboardKey: PinboardKey;
  input: ReorderBody;
}

export function useReorderPinboard(
  options?: Omit<
    UseMutationOptions<
      PinboardOkResponse,
      Error,
      ReorderPinboardVariables,
      BoardSnapshot
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation<
    PinboardOkResponse,
    Error,
    ReorderPinboardVariables,
    BoardSnapshot
  >({
    mutationFn: ({ realmUnitId, pinboardKey, input }) =>
      pinboardApi.reorder(realmUnitId, pinboardKey, input),
    ...options,
    onMutate: async (variables, mutationContext) => {
      await queryClient.cancelQueries({
        queryKey: pinboardKeys.board(
          variables.realmUnitId,
          variables.pinboardKey,
        ),
      });
      const snapshot = snapshotBoard(
        queryClient,
        variables.realmUnitId,
        variables.pinboardKey,
      );
      mapListVariants(
        queryClient,
        variables.realmUnitId,
        variables.pinboardKey,
        (entries) => {
          const byId = new Map(entries.map((e) => [e.unitId, e]));
          const reordered: PinboardEntryDTO[] = [];
          for (const id of variables.input.orderedUnitIds) {
            const entry = byId.get(id);
            if (entry) reordered.push(entry);
          }
          return reordered.length === entries.length ? reordered : entries;
        },
      );
      await options?.onMutate?.(variables, mutationContext);
      return snapshot;
    },
    onError: (error, variables, snapshot, mutationContext) => {
      if (snapshot) restoreBoard(queryClient, snapshot);
      options?.onError?.(error, variables, snapshot, mutationContext);
    },
    onSettled: (data, error, variables, snapshot, mutationContext) => {
      invalidateBoard(queryClient, variables.realmUnitId, variables.pinboardKey);
      options?.onSettled?.(data, error, variables, snapshot, mutationContext);
    },
  });
}

export const pinboardMutations = {
  useCreate: useCreatePinboardEntry,
  useUpdate: useUpdatePinboardEntry,
  useDelete: useDeletePinboardEntry,
  usePin: usePinToPinboard,
  useUnpin: useUnpinFromPinboard,
  useReorder: useReorderPinboard,
};
