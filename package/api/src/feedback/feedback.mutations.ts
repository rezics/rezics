import type { CreateFeedbackInput, FeedbackDTO } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { feedbackApi } from "./feedback.api";
import { feedbackKeys } from "./feedback.keys";

const feedbackInvalidates = [feedbackKeys.all()];

export function useCreateFeedbackMutation(
  options?: Omit<
    UseMutationOptions<FeedbackDTO, Error, CreateFeedbackInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateFeedbackInput) => feedbackApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(feedbackKeys.detail(data.id), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: feedbackInvalidates },
  });
}

export function useSetFeedbackResolvedMutation(
  options?: Omit<
    UseMutationOptions<FeedbackDTO, Error, { id: string; resolved: boolean }>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, resolved }) => feedbackApi.setResolved(id, resolved),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(feedbackKeys.detail(variables.id), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: feedbackInvalidates },
  });
}

export const feedbackMutations = {
  useCreate: useCreateFeedbackMutation,
  useSetResolved: useSetFeedbackResolvedMutation,
};
