import type {
  ApiTokenDTO,
  CreateApiTokenInput,
  CreateApiTokenResponse,
  UpdateApiTokenInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { tokenApi } from "./token.api";
import { tokenKeys } from "./token.keys";

const tokenInvalidates = [tokenKeys.all()];

export function useCreateTokenMutation(
  options?: Omit<
    UseMutationOptions<CreateApiTokenResponse, Error, CreateApiTokenInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateApiTokenInput) => tokenApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      if (data.tokenInfo?.id) {
        queryClient.setQueryData(
          tokenKeys.detail(data.tokenInfo.id),
          data.tokenInfo as ApiTokenDTO,
        );
      }
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: tokenInvalidates },
  });
}

export function useUpdateTokenMutation(
  options?: Omit<
    UseMutationOptions<
      ApiTokenDTO,
      Error,
      { id: string; input: UpdateApiTokenInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }) => tokenApi.update(id, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(tokenKeys.detail(variables.id), data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
    meta: { invalidates: tokenInvalidates },
  });
}

export function useRevokeTokenMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tokenApi.revoke(id),
    ...options,
    onSuccess: (data, id, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: tokenKeys.detail(id) });
      options?.onSuccess?.(data, id, onMutateResult, context);
    },
    meta: { invalidates: tokenInvalidates },
  });
}

export const tokenMutations = {
  useCreate: useCreateTokenMutation,
  useUpdate: useUpdateTokenMutation,
  useRevoke: useRevokeTokenMutation,
};
