import type {
  CreateJwtServiceInput,
  JwtServiceDTO,
  UpdateJwtServiceInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { authJwtServiceApi } from "./auth-jwt-service.api";
import { authJwtServiceKeys } from "./auth-jwt-service.keys";

export function useCreateAuthJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<JwtServiceDTO, Error, CreateJwtServiceInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateJwtServiceInput) =>
      authJwtServiceApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: authJwtServiceKeys.lists() });
      queryClient.setQueryData(
        authJwtServiceKeys.detail(data.serviceKey),
        data,
      );
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateAuthJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<
      JwtServiceDTO,
      Error,
      { serviceKey: string; input: UpdateJwtServiceInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ serviceKey, input }) =>
      authJwtServiceApi.update(serviceKey, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(
        authJwtServiceKeys.detail(variables.serviceKey),
        data,
      );
      queryClient.invalidateQueries({ queryKey: authJwtServiceKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useActivateAuthJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<JwtServiceDTO, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceKey: string) => authJwtServiceApi.activate(serviceKey),
    ...options,
    onSuccess: (data, serviceKey, onMutateResult, context) => {
      queryClient.setQueryData(authJwtServiceKeys.detail(serviceKey), data);
      queryClient.invalidateQueries({ queryKey: authJwtServiceKeys.lists() });
      options?.onSuccess?.(data, serviceKey, onMutateResult, context);
    },
  });
}

export function useDeactivateAuthJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<JwtServiceDTO, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceKey: string) =>
      authJwtServiceApi.deactivate(serviceKey),
    ...options,
    onSuccess: (data, serviceKey, onMutateResult, context) => {
      queryClient.setQueryData(authJwtServiceKeys.detail(serviceKey), data);
      queryClient.invalidateQueries({ queryKey: authJwtServiceKeys.lists() });
      options?.onSuccess?.(data, serviceKey, onMutateResult, context);
    },
  });
}

export function useRotateAuthJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<JwtServiceDTO, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceKey: string) => authJwtServiceApi.rotate(serviceKey),
    ...options,
    onSuccess: (data, serviceKey, onMutateResult, context) => {
      queryClient.setQueryData(authJwtServiceKeys.detail(serviceKey), data);
      queryClient.invalidateQueries({ queryKey: authJwtServiceKeys.lists() });
      options?.onSuccess?.(data, serviceKey, onMutateResult, context);
    },
  });
}

export const authJwtServiceMutations = {
  useCreate: useCreateAuthJwtServiceMutation,
  useUpdate: useUpdateAuthJwtServiceMutation,
  useActivate: useActivateAuthJwtServiceMutation,
  useDeactivate: useDeactivateAuthJwtServiceMutation,
  useRotate: useRotateAuthJwtServiceMutation,
};
