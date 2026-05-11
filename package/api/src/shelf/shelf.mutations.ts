import type {
  AddShelfItemInput,
  CleanupShelfOrphansInput,
  CollectInput,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfItemInput,
  SetShelfItemTagsInput,
  ShelfItemBatchOp,
  ShelfItemBatchResponse,
  ShelfItemDTO,
  ShelfResponse,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { collectionApi, shelfApi } from "./shelf.api";
import { collectionKeys, shelfKeys } from "./shelf.keys";

function invalidateShelfCollections(
  queryClient: ReturnType<typeof useQueryClient>,
) {
  queryClient.invalidateQueries({ queryKey: shelfKeys.lists() });
  queryClient.invalidateQueries({ queryKey: shelfKeys.mine() });
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

export function useAddShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      { shelfUnitId: string; input: AddShelfItemInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, input }) =>
      shelfApi.addItem(shelfUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: shelfKeys.items(variables.shelfUnitId),
      });
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useReorderShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      {
        shelfUnitId: string;
        itemRef: string;
        input: ReorderShelfItemInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, itemRef, input }) =>
      shelfApi.reorderItem(shelfUnitId, itemRef, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: shelfKeys.items(variables.shelfUnitId),
      });
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { shelfUnitId: string; itemRef: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, itemRef }) =>
      shelfApi.removeItem(shelfUnitId, itemRef),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: shelfKeys.items(variables.shelfUnitId),
      });
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useAttachReviewMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      { shelfUnitId: string; itemRef: string; reviewUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, itemRef, reviewUnitId }) =>
      shelfApi.attachReview(shelfUnitId, itemRef, reviewUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: shelfKeys.items(variables.shelfUnitId),
      });
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDetachReviewMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      { shelfUnitId: string; itemRef: string; reviewUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, itemRef, reviewUnitId }) =>
      shelfApi.detachReview(shelfUnitId, itemRef, reviewUnitId),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: shelfKeys.items(variables.shelfUnitId),
      });
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useSetShelfItemTagsMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      {
        shelfUnitId: string;
        itemRef: string;
        input: SetShelfItemTagsInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, itemRef, input }) =>
      shelfApi.setItemTags(shelfUnitId, itemRef, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: shelfKeys.items(variables.shelfUnitId),
      });
      invalidateShelfCollections(queryClient);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useBatchUpdateShelfItemsMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemBatchResponse,
      Error,
      { shelfUnitId: string; ops: ShelfItemBatchOp[] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, ops }) =>
      shelfApi.batchUpdateItems(shelfUnitId, ops),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: shelfKeys.items(variables.shelfUnitId),
      });
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
      { shelfUnitId: string; input: CleanupShelfOrphansInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, input }) =>
      shelfApi.cleanupOrphans(shelfUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: shelfKeys.detail(variables.shelfUnitId),
      });
      queryClient.invalidateQueries({
        queryKey: shelfKeys.items(variables.shelfUnitId),
      });
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
      queryClient.invalidateQueries({
        queryKey: collectionKeys.status(variables.targetId),
      });
      invalidateShelfCollections(queryClient);
      for (const shelfId of data.savedTo) {
        queryClient.invalidateQueries({
          queryKey: shelfKeys.detail(shelfId),
        });
        queryClient.invalidateQueries({
          queryKey: shelfKeys.items(shelfId),
        });
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
      queryClient.invalidateQueries({
        queryKey: collectionKeys.status(targetId),
      });
      queryClient.invalidateQueries({ queryKey: shelfKeys.mine() });
      options?.onSuccess?.(data, targetId, onMutateResult, context);
    },
  });
}

export const shelfMutations = {
  useCreate: useCreateShelfMutation,
  useUpdate: useUpdateShelfMutation,
  useDelete: useDeleteShelfMutation,
  useAddItem: useAddShelfItemMutation,
  useReorderItem: useReorderShelfItemMutation,
  useRemoveItem: useRemoveShelfItemMutation,
  useAttachReview: useAttachReviewMutation,
  useDetachReview: useDetachReviewMutation,
  useSetItemTags: useSetShelfItemTagsMutation,
  useBatchUpdateItems: useBatchUpdateShelfItemsMutation,
  useCleanupOrphans: useCleanupOrphansMutation,
};

export const collectionMutations = {
  useCollect: useCollectMutation,
  useToggleFavorite: useToggleFavoriteMutation,
};
