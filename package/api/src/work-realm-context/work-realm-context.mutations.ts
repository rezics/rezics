import type {
  CreateWorkRealmContextInput,
  UpdateWorkRealmContextInput,
  WorkRealmContextDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { workRealmContextApi } from "./work-realm-context.api";
import { workRealmContextKeys } from "./work-realm-context.keys";

export function invalidateWorkRealmContextQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, "invalidateQueries">,
  context?: Pick<
    WorkRealmContextDTO,
    "id" | "workUnitId" | "realmUnitId" | "releaseUnitId"
  >,
) {
  queryClient.invalidateQueries({ queryKey: workRealmContextKeys.lists() });
  queryClient.invalidateQueries({ queryKey: workRealmContextKeys.resolves() });

  if (context) {
    queryClient.invalidateQueries({
      queryKey: workRealmContextKeys.detail(context.id),
    });
  }
}

export function useCreateWorkRealmContext(
  options?: Omit<
    UseMutationOptions<WorkRealmContextDTO, Error, CreateWorkRealmContextInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateWorkRealmContextInput) =>
      workRealmContextApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(workRealmContextKeys.detail(data.id), data);
      invalidateWorkRealmContextQueries(queryClient, data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateWorkRealmContext(
  options?: Omit<
    UseMutationOptions<
      WorkRealmContextDTO,
      Error,
      { contextId: string; input: UpdateWorkRealmContextInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contextId, input }) =>
      workRealmContextApi.update(contextId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(workRealmContextKeys.detail(data.id), data);
      invalidateWorkRealmContextQueries(queryClient, data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteWorkRealmContext(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contextId: string) => workRealmContextApi.remove(contextId),
    ...options,
    onSuccess: (data, contextId, onMutateResult, context) => {
      queryClient.removeQueries({
        queryKey: workRealmContextKeys.detail(contextId),
      });
      invalidateWorkRealmContextQueries(queryClient);
      options?.onSuccess?.(data, contextId, onMutateResult, context);
    },
  });
}

export const workRealmContextMutations = {
  useCreate: useCreateWorkRealmContext,
  useUpdate: useUpdateWorkRealmContext,
  useDelete: useDeleteWorkRealmContext,
};
