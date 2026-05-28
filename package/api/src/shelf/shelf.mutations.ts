import type {
  AddShelfUnitInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfUnitInput,
  SetPinnedTagsInput,
  SetPinnedTagsResponse,
  SetShelfUnitChildrenInput,
  ShelfResponse,
  ShelfUnitBatchOp,
  ShelfUnitBatchResponse,
  ShelfUnitDTO,
  ShelfUnitRelationDTO,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateForCacheDomain } from "../react-query/cache-coherence";
import { collectionApi, shelfApi } from "./shelf.api";
import { collectionKeys, shelfKeys } from "./shelf.keys";

function invalidateShelfCollections(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: shelfKeys.lists() });
  queryClient.invalidateQueries({ queryKey: shelfKeys.mine() });
  void invalidateForCacheDomain(queryClient, "collect");
}

function invalidateShelfDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  shelfId: string,
) {
  queryClient.invalidateQueries({ queryKey: shelfKeys.detail(shelfId) });
  queryClient.invalidateQueries({ queryKey: shelfKeys.units(shelfId) });
}

export function useCreateShelfMutation(
  options?: Omit<
    UseMutationOptions<ShelfResponse, Error, CreateShelfInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateShelfInput) => shelfApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfCollections(queryClient);
      queryClient.setQueryData(shelfKeys.detail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateShelfMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfResponse,
      Error,
      { unitId: string; input: UpdateShelfInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) => shelfApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(shelfKeys.detail(variables.unitId), data);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteShelfMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => shelfApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: shelfKeys.detail(unitId) });
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

export function useAddShelfUnitMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfUnitDTO,
      Error,
      { shelfId: string; input: AddShelfUnitInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, input }) => shelfApi.addUnit(shelfId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useReorderShelfUnitMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfUnitDTO,
      Error,
      {
        shelfId: string;
        shelfUnitId: string;
        input: ReorderShelfUnitInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, shelfUnitId, input }) =>
      shelfApi.reorderUnit(shelfId, shelfUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveShelfUnitMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { shelfId: string; shelfUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, shelfUnitId }) =>
      shelfApi.removeUnit(shelfId, shelfUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useAttachReviewMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfUnitRelationDTO,
      Error,
      { shelfId: string; shelfUnitId: string; reviewUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, shelfUnitId, reviewUnitId }) =>
      shelfApi.attachReview(shelfId, shelfUnitId, reviewUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDetachReviewMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { shelfId: string; shelfUnitId: string; reviewUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, shelfUnitId, reviewUnitId }) =>
      shelfApi.detachReview(shelfId, shelfUnitId, reviewUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useSetShelfUnitChildrenMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      {
        shelfId: string;
        shelfUnitId: string;
        input: SetShelfUnitChildrenInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, shelfUnitId, input }) =>
      shelfApi.setChildren(shelfId, shelfUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useBatchUpdateShelfUnitsMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfUnitBatchResponse,
      Error,
      { shelfId: string; ops: ShelfUnitBatchOp[] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, ops }) => shelfApi.batchUpdateUnits(shelfId, ops),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useSetShelfPinnedTagsMutation(
  options?: Omit<
    UseMutationOptions<
      SetPinnedTagsResponse,
      Error,
      { shelfId: string; input: SetPinnedTagsInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, input }) => shelfApi.setPinnedTags(shelfId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useCleanupOrphansMutation(
  options?: Omit<
    UseMutationOptions<
      { deleted: number },
      Error,
      { shelfId: string; input: CleanupShelfOrphansInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfId, input }) => shelfApi.cleanupOrphans(shelfId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateShelfDetail(queryClient, variables.shelfId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

// Collection mutations

export function useCollectMutation(
  options?: Omit<
    UseMutationOptions<CollectResponse, Error, CollectInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CollectInput) => collectionApi.collect(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all() });
      invalidateShelfCollections(queryClient);
      for (const shelfId of data.savedTo) {
        invalidateShelfDetail(queryClient, shelfId);
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useToggleFavoriteMutation(
  options?: Omit<
    UseMutationOptions<ToggleFavoriteResponse, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (targetId: string) => collectionApi.toggleFavorite(targetId),
    ...options,
    onSuccess: (data, targetId, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: collectionKeys.all() });
      queryClient.invalidateQueries({ queryKey: shelfKeys.mine() });
      options?.onSuccess?.(data, targetId, onMutateResult, context);
    },
  });
}

export const shelfMutations = {
  useCreate: useCreateShelfMutation,
  useUpdate: useUpdateShelfMutation,
  useDelete: useDeleteShelfMutation,
  useAddUnit: useAddShelfUnitMutation,
  useReorderUnit: useReorderShelfUnitMutation,
  useRemoveUnit: useRemoveShelfUnitMutation,
  useAttachReview: useAttachReviewMutation,
  useDetachReview: useDetachReviewMutation,
  useSetChildren: useSetShelfUnitChildrenMutation,
  useBatchUpdateUnits: useBatchUpdateShelfUnitsMutation,
  useSetPinnedTags: useSetShelfPinnedTagsMutation,
  useCleanupOrphans: useCleanupOrphansMutation,
};

export const collectionMutations = {
  useCollect: useCollectMutation,
  useToggleFavorite: useToggleFavoriteMutation,
};
