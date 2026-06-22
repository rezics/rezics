import type {
  ChapterMaterializationRequest,
  ChapterMaterializationResponse,
  ChapterResponse,
  CreateChapterInput,
  UpdateChapterInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { bookKeys } from "../book/book.keys";
import { chapterApi } from "./chapter.api";
import { chapterKeys } from "./chapter.keys";

const chapterInvalidates = [chapterKeys.all()];

export function useCreateChapterMutation(
  options?: Omit<
    UseMutationOptions<ChapterResponse, Error, CreateChapterInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateChapterInput) => chapterApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(chapterKeys.detail(data.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: chapterInvalidates },
  });
}

export function useUpdateChapterMutation(
  options?: Omit<
    UseMutationOptions<
      ChapterResponse,
      Error,
      { unitId: string; input: UpdateChapterInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) => chapterApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(chapterKeys.detail(variables.unitId), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: chapterInvalidates },
  });
}

export function useDeleteChapterMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => chapterApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: chapterKeys.detail(unitId) });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
    meta: { invalidates: chapterInvalidates },
  });
}

export function useMaterializeChapterMutation(
  options?: Omit<
    UseMutationOptions<
      ChapterMaterializationResponse,
      Error,
      { bookUnitId: string; input: ChapterMaterializationRequest }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ bookUnitId, input }) =>
      chapterApi.materializeNode(bookUnitId, input),
    ...options,
    meta: { invalidates: [bookKeys.all(), chapterKeys.all()] },
  });
}

export const chapterMutations = {
  useCreate: useCreateChapterMutation,
  useUpdate: useUpdateChapterMutation,
  useDelete: useDeleteChapterMutation,
  useMaterialize: useMaterializeChapterMutation,
};
