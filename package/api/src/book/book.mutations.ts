import type {
  BookContentStructureItem,
  BookResponse,
  CreateBookInput,
  EditorialPatchSubmission,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { preserveCachedTranslations } from "../react-query/cache-coherence";
import { bookApi } from "./book.api";
import { bookKeys } from "./book.keys";

const bookInvalidates = [bookKeys.all()];

export function useCreateBookMutation(
  options?: Omit<
    UseMutationOptions<BookResponse, Error, CreateBookInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBookInput) => bookApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(bookKeys.detail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: bookInvalidates },
  });
}

export function useUpdateBookMutation(
  options?: Omit<
    UseMutationOptions<
      BookResponse,
      Error,
      { unitId: string; input: EditorialPatchSubmission }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) => bookApi.update(unitId, input),
    ...options,
    onSuccess: async (data, variables, onMutateResult, context) => {
      const detailKey = bookKeys.detail(variables.unitId);
      await queryClient.cancelQueries({ queryKey: detailKey, exact: true });
      queryClient.setQueryData<BookResponse>(detailKey, (current) =>
        preserveCachedTranslations(data, current),
      );
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: bookInvalidates },
  });
}

export function useDeleteBookMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => bookApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: bookKeys.detail(unitId) });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
    meta: { invalidates: bookInvalidates },
  });
}

export function useUpdateContentStructureMutation(
  options?: Omit<
    UseMutationOptions<
      any,
      Error,
      {
        bookUnitId: string;
        nodes: BookContentStructureItem[];
      }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ bookUnitId, nodes }) =>
      bookApi.updateContentStructure(bookUnitId, nodes),
    ...options,
    meta: { invalidates: bookInvalidates },
  });
}

export const bookMutations = {
  useCreate: useCreateBookMutation,
  useUpdate: useUpdateBookMutation,
  useDelete: useDeleteBookMutation,
  useUpdateContentStructure: useUpdateContentStructureMutation,
};
