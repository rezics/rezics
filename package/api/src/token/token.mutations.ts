/**
 * React Query mutations for Token operations
 * 用于 Token 操作的 React Query mutations
 */

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
      // Invalidate token list to include the new token
      // 使 token 列表失效以纳入新建的 token
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });

      // Optionally pre-populate detail cache for the created token
      // 可选地为新建的 token 预填充 detail 缓存
      if (data.tokenInfo?.id) {
        queryClient.setQueryData(
          tokenKeys.detail(data.tokenInfo.id),
          data.tokenInfo as ApiTokenDTO,
        );
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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

      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
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

      // Invalidate token list to remove revoked token
      // 使 token 列表失效以移除已撤销的 token
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });

      options?.onSuccess?.(data, id, onMutateResult, context);
    },
  });
}

export const tokenMutations = {
  useCreate: useCreateTokenMutation,
  useUpdate: useUpdateTokenMutation,
  useRevoke: useRevokeTokenMutation,
};
