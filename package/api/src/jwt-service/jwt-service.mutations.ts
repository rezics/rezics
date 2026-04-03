import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
} from '@tanstack/react-query';
import {jwtServiceApi} from './jwt-service.api';
import {jwtServiceKeys} from './jwt-service.keys';
import type {
  JwtServiceDTO,
  CreateJwtServiceInput,
  UpdateJwtServiceInput,
} from '@rezics/contract';

export function useCreateJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<JwtServiceDTO, Error, CreateJwtServiceInput>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateJwtServiceInput) => jwtServiceApi.create(input),
    ...options,
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({queryKey: jwtServiceKeys.lists()});
      queryClient.setQueryData(
        jwtServiceKeys.detail(data.serviceKey),
        data,
      );
      options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useUpdateJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<
      JwtServiceDTO,
      Error,
      {serviceKey: string; input: UpdateJwtServiceInput}
    >,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({serviceKey, input}) =>
      jwtServiceApi.update(serviceKey, input),
    ...options,
    onSuccess: (data, variables, context) => {
      queryClient.setQueryData(
        jwtServiceKeys.detail(variables.serviceKey),
        data,
      );
      queryClient.invalidateQueries({queryKey: jwtServiceKeys.lists()});
      options?.onSuccess?.(data, variables, context);
    },
  });
}

export function useActivateJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<JwtServiceDTO, Error, string>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceKey: string) => jwtServiceApi.activate(serviceKey),
    ...options,
    onSuccess: (data, serviceKey, context) => {
      queryClient.setQueryData(
        jwtServiceKeys.detail(serviceKey),
        data,
      );
      queryClient.invalidateQueries({queryKey: jwtServiceKeys.lists()});
      options?.onSuccess?.(data, serviceKey, context);
    },
  });
}

export function useDeactivateJwtServiceMutation(
  options?: Omit<
    UseMutationOptions<JwtServiceDTO, Error, string>,
    'mutationFn'
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (serviceKey: string) => jwtServiceApi.deactivate(serviceKey),
    ...options,
    onSuccess: (data, serviceKey, context) => {
      queryClient.setQueryData(
        jwtServiceKeys.detail(serviceKey),
        data,
      );
      queryClient.invalidateQueries({queryKey: jwtServiceKeys.lists()});
      options?.onSuccess?.(data, serviceKey, context);
    },
  });
}

export const jwtServiceMutations = {
  useCreate: useCreateJwtServiceMutation,
  useUpdate: useUpdateJwtServiceMutation,
  useActivate: useActivateJwtServiceMutation,
  useDeactivate: useDeactivateJwtServiceMutation,
};
