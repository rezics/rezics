import type {
  AddShelfItemInput,
  CollectInput,
  CollectResponse,
  CreateShelfInput,
  ReorderShelfItemsInput,
  ShelfItemDTO,
  ShelfResponse,
  ToggleFavoriteResponse,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { collectionApi, shelfApi, userKeywordsApi } from "./shelf.api";
import { collectionKeys, shelfKeys, userKeywordKeys } from "./shelf.keys";

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
      queryClient.invalidateQueries({ queryKey: shelfKeys.lists() });
      queryClient.invalidateQueries({ queryKey: shelfKeys.mine() });
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
      queryClient.invalidateQueries({ queryKey: shelfKeys.lists() });
      queryClient.invalidateQueries({ queryKey: shelfKeys.mine() });
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
      queryClient.invalidateQueries({ queryKey: shelfKeys.lists() });
      queryClient.invalidateQueries({ queryKey: shelfKeys.mine() });
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
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      {
        shelfUnitId: string;
        itemUnitId: string;
        input: UpdateShelfItemInput;
      }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, itemUnitId, input }) =>
      shelfApi.updateItem(shelfUnitId, itemUnitId, input),
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

export function useReorderShelfItemsMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { shelfUnitId: string; input: ReorderShelfItemsInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, input }) =>
      shelfApi.reorderItems(shelfUnitId, input),
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

export function useRemoveShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { shelfUnitId: string; itemUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, itemUnitId }) =>
      shelfApi.removeItem(shelfUnitId, itemUnitId),
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

export function useDetachReviewMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { shelfUnitId: string; itemUnitId: string; reviewUnitId: string }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ shelfUnitId, itemUnitId, reviewUnitId }) =>
      shelfApi.detachReview(shelfUnitId, itemUnitId, reviewUnitId),
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
      queryClient.invalidateQueries({ queryKey: shelfKeys.mine() });
      queryClient.invalidateQueries({ queryKey: userKeywordKeys.mine() });
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

// User keywords mutations

export function useUpdateKeywordsMutation(
  options?: Omit<
    UseMutationOptions<
      string[],
      Error,
      { add?: string[]; remove?: string[] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input) => userKeywordsApi.update(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(userKeywordKeys.mine(), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const shelfMutations = {
  useCreate: useCreateShelfMutation,
  useUpdate: useUpdateShelfMutation,
  useDelete: useDeleteShelfMutation,
  useAddItem: useAddShelfItemMutation,
  useUpdateItem: useUpdateShelfItemMutation,
  useReorderItems: useReorderShelfItemsMutation,
  useRemoveItem: useRemoveShelfItemMutation,
  useDetachReview: useDetachReviewMutation,
};

export const collectionMutations = {
  useCollect: useCollectMutation,
  useToggleFavorite: useToggleFavoriteMutation,
};

export const userKeywordMutations = {
  useUpdate: useUpdateKeywordsMutation,
};
