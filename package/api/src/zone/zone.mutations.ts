import type { ZoneDTO } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  zoneApi,
  type CreateZoneInput,
  type UpdateZoneInput,
} from "./zone.api";
import { zoneKeys } from "./zone.keys";

export function invalidateZoneQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, "invalidateQueries">,
  zone?: Pick<ZoneDTO, "slug">,
) {
  queryClient.invalidateQueries({ queryKey: zoneKeys.details() });
  if (zone) {
    queryClient.invalidateQueries({ queryKey: zoneKeys.detail(zone.slug) });
  }
}

export function useCreateZone(
  options?: Omit<
    UseMutationOptions<ZoneDTO, Error, CreateZoneInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateZoneInput) => zoneApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(zoneKeys.detail(data.slug), data);
      invalidateZoneQueries(queryClient, data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateZone(
  options?: Omit<
    UseMutationOptions<
      ZoneDTO,
      Error,
      { unitId: string; input: UpdateZoneInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) => zoneApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(zoneKeys.detail(data.slug), data);
      queryClient.setQueryData(zoneKeys.byUnitId(variables.unitId), data);
      invalidateZoneQueries(queryClient, data);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteZone(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => zoneApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: zoneKeys.byUnitId(unitId) });
      invalidateZoneQueries(queryClient);
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

export const zoneMutations = {
  useCreate: useCreateZone,
  useUpdate: useUpdateZone,
  useDelete: useDeleteZone,
};
