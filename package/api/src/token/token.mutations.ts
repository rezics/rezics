/**
 * React Query mutations for Token operations
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

/**
 * Mutation for creating a token
 */
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
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });

      // Optionally pre-populate detail cache for the created token
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

/**
 * Mutation for updating a token
 */
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
      // Update detail cache for this token
      queryClient.setQueryData(tokenKeys.detail(variables.id), data);

      // Invalidate token list to refresh
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for revoking a token
 */
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
      // Remove detail cache for revoked token
      queryClient.removeQueries({ queryKey: tokenKeys.detail(id) });

      // Invalidate token list to remove revoked token
      queryClient.invalidateQueries({ queryKey: tokenKeys.lists() });

      options?.onSuccess?.(data, id, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 */
export const tokenMutations = {
  useCreate: useCreateTokenMutation,
  useUpdate: useUpdateTokenMutation,
  useRevoke: useRevokeTokenMutation,
};
