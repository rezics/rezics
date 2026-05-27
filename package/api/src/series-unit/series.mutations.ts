import type {
  ContentStructureItem,
  ContentStructureResponse,
  CreateSeriesInput,
  SeriesResponse,
  UpdateSeriesInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { seriesApi } from "./series.api";
import { seriesKeys } from "./series.keys";

export function useCreateSeriesMutation(
  options?: Omit<
    UseMutationOptions<SeriesResponse, Error, CreateSeriesInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: seriesApi.create,
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateSeriesMutation(
  options?: Omit<
    UseMutationOptions<
      SeriesResponse,
      Error,
      { unitId: string; input: UpdateSeriesInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, input }) => seriesApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: seriesKeys.detail(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateSeriesContentStructureMutation(
  options?: Omit<
    UseMutationOptions<
      ContentStructureResponse,
      Error,
      { unitId: string; nodes: ContentStructureItem[] }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ unitId, nodes }) =>
      seriesApi.updateContentStructure(unitId, nodes),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.invalidateQueries({
        queryKey: seriesKeys.detail(variables.unitId),
      });
      queryClient.invalidateQueries({
        queryKey: seriesKeys.contentIndex(variables.unitId),
      });
      queryClient.invalidateQueries({ queryKey: seriesKeys.lists() });
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export const seriesMutations = {
  useCreate: useCreateSeriesMutation,
  useUpdate: useUpdateSeriesMutation,
  useUpdateContentStructure: useUpdateSeriesContentStructureMutation,
};
