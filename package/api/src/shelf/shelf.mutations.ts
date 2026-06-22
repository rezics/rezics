import type {
  AddShelfItemInput,
  CleanupShelfOrphansInput,
  AddToShelvesInput,
  AddToShelvesResponse,
  CreateShelfInput,
  ReorderShelfItemInput,
  SetPinnedTagsInput,
  SetPinnedTagsResponse,
  SetShelfItemChildrenInput,
  ShelfItemBatchOp,
  ShelfItemBatchResponse,
  ShelfItemChildDTO,
  ShelfItemDTO,
  ShelfItemType,
  ShelfResponse,
  ToggleFavoriteResponse,
  UpdateShelfInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { cacheDomainKeys } from "../react-query/cache-coherence";
import { shelfItemActionApi, shelfApi } from "./shelf.api";
import { shelfKeys } from "./shelf.keys";

const invalidatesShelfItem = cacheDomainKeys("shelf-item");

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
      queryClient.setQueryData(shelfKeys.detail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: invalidatesShelfItem },
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
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: invalidatesShelfItem, successToast: "common:saved" },
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
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useAddShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      { shelfId: string; input: AddShelfItemInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ shelfId, input }) => shelfApi.addItem(shelfId, input),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useReorderShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemDTO,
      Error,
      {
        shelfId: string;
        itemType: ShelfItemType;
        itemId: string;
        input: ReorderShelfItemInput;
      }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ shelfId, itemType, itemId, input }) =>
      shelfApi.reorderItem(shelfId, itemType, itemId, input),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useRemoveShelfItemMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      { shelfId: string; itemType: ShelfItemType; itemId: string }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ shelfId, itemType, itemId }) =>
      shelfApi.removeItem(shelfId, itemType, itemId),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useAttachReviewMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemChildDTO,
      Error,
      {
        shelfId: string;
        shelfItemType: ShelfItemType;
        shelfItemId: string;
        reviewUnitId: string;
      }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ shelfId, shelfItemType, shelfItemId, reviewUnitId }) =>
      shelfApi.attachReview(shelfId, shelfItemType, shelfItemId, reviewUnitId),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useDetachReviewMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      {
        shelfId: string;
        shelfItemType: ShelfItemType;
        shelfItemId: string;
        reviewUnitId: string;
      }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ shelfId, shelfItemType, shelfItemId, reviewUnitId }) =>
      shelfApi.detachReview(shelfId, shelfItemType, shelfItemId, reviewUnitId),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useSetShelfItemChildrenMutation(
  options?: Omit<
    UseMutationOptions<
      { message: string },
      Error,
      {
        shelfId: string;
        shelfItemType: ShelfItemType;
        shelfItemId: string;
        input: SetShelfItemChildrenInput;
      }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ shelfId, shelfItemType, shelfItemId, input }) =>
      shelfApi.setChildren(shelfId, shelfItemType, shelfItemId, input),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useBatchUpdateShelfItemsMutation(
  options?: Omit<
    UseMutationOptions<
      ShelfItemBatchResponse,
      Error,
      { shelfId: string; ops: ShelfItemBatchOp[] }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ shelfId, ops }) => shelfApi.batchUpdateItems(shelfId, ops),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
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
  return useMutation({
    mutationFn: ({ shelfId, input }) => shelfApi.setPinnedTags(shelfId, input),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
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
  return useMutation({
    mutationFn: ({ shelfId, input }) => shelfApi.cleanupOrphans(shelfId, input),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useAddToShelvesMutation(
  options?: Omit<
    UseMutationOptions<AddToShelvesResponse, Error, AddToShelvesInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: AddToShelvesInput) =>
      shelfItemActionApi.addToShelves(input),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export function useToggleFavoriteMutation(
  options?: Omit<
    UseMutationOptions<ToggleFavoriteResponse, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (targetId: string) =>
      shelfItemActionApi.toggleFavorite(targetId),
    ...options,
    meta: { invalidates: invalidatesShelfItem },
  });
}

export const shelfMutations = {
  useCreate: useCreateShelfMutation,
  useUpdate: useUpdateShelfMutation,
  useDelete: useDeleteShelfMutation,
  useAddUnit: useAddShelfItemMutation,
  useReorderUnit: useReorderShelfItemMutation,
  useRemoveUnit: useRemoveShelfItemMutation,
  useAttachReview: useAttachReviewMutation,
  useDetachReview: useDetachReviewMutation,
  useSetChildren: useSetShelfItemChildrenMutation,
  useBatchUpdateUnits: useBatchUpdateShelfItemsMutation,
  useSetPinnedTags: useSetShelfPinnedTagsMutation,
  useCleanupOrphans: useCleanupOrphansMutation,
};

export const shelfItemActionMutations = {
  useAddToShelves: useAddToShelvesMutation,
  useToggleFavorite: useToggleFavoriteMutation,
};
