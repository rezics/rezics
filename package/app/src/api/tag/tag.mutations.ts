import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {tagApi} from './tag.api';
import {tagKeys} from './tag.keys';
import type {CreateTagInput, UpdateTagInput} from '@package/contract';

export function useCreateTagMutation(
  options?: Omit<UseMutationOptions<any, Error, CreateTagInput>, 'mutationFn'>,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateTagInput) => tagApi.create(input),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({queryKey: tagKeys.lists()});
      // contract TagDetailDTO uses `id` field
      // pre-populate detail cache if available (TagDetailDTO uses `id`)
      queryClient.setQueryData(tagKeys.detail((data as any).id), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useUpdateTagMutation(
  options?: Omit<
    UseMutationOptions<any, Error, {unitId: string; input: UpdateTagInput}>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({unitId, input}: {unitId: string; input: UpdateTagInput}) =>
      tagApi.update(unitId, input),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(tagKeys.detail(variables.unitId), data);
      queryClient.invalidateQueries({queryKey: tagKeys.lists()});
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useDeleteTagMutation(
  options?: Omit<
    UseMutationOptions<{message: string}, Error, string>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => tagApi.remove(unitId),
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({queryKey: tagKeys.detail(unitId)});
      queryClient.invalidateQueries({queryKey: tagKeys.lists()});
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
    ...options,
  });
}

export function useAttachTagMutation(
  options?: Omit<
    UseMutationOptions<
      {message: string},
      Error,
      {unitId: string; targetUnitId: string}
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({unitId, targetUnitId}) => tagApi.attach(unitId, targetUnitId),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({queryKey: tagKeys.lists()});
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

export function useDetachTagMutation(
  options?: Omit<
    UseMutationOptions<
      {message: string},
      Error,
      {unitId: string; targetUnitId: string}
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({unitId, targetUnitId}) => tagApi.detach(unitId, targetUnitId),
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({queryKey: tagKeys.lists()});
      queryClient.invalidateQueries({
        queryKey: tagKeys.detail(variables.unitId),
      });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    ...options,
  });
}

export const tagMutations = {
  useCreate: useCreateTagMutation,
  useUpdate: useUpdateTagMutation,
  useDelete: useDeleteTagMutation,
  useAttach: useAttachTagMutation,
  useDetach: useDetachTagMutation,
};
