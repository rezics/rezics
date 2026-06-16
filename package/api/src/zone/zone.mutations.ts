import type {
  CreateZoneInput,
  UpdateZoneInput,
  ZoneDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { zoneApi } from "./zone.api";
import { zoneKeys } from "./zone.keys";

export function invalidateZoneQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, "invalidateQueries">,
) {
  queryClient.invalidateQueries({ queryKey: zoneKeys.details() });
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
      invalidateZoneQueries(queryClient);
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
      // Invalidate everything zone-shaped (detail, portal, sections) — a
      // config update can change any section's data.
      // 使所有专区形态的查询（详情、门户、分区）失效——配置更新可能改变
      // 任何分区的数据。
      invalidateZoneQueries(queryClient);
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
