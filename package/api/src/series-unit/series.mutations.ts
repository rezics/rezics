import type {
  ContentStructureItem,
  ContentStructureResponse,
  CreateSeriesInput,
  SeriesResponse,
  UpdateSeriesInput,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { seriesApi } from "./series.api";
import { seriesKeys } from "./series.keys";

const invalidates = [seriesKeys.all()];

export function useCreateSeriesMutation(
  options?: Omit<
    UseMutationOptions<SeriesResponse, Error, CreateSeriesInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: seriesApi.create,
    ...options,
    meta: { invalidates },
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
  return useMutation({
    mutationFn: ({ unitId, input }) => seriesApi.update(unitId, input),
    ...options,
    meta: { invalidates },
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
  return useMutation({
    mutationFn: ({ unitId, nodes }) =>
      seriesApi.updateContentStructure(unitId, nodes),
    ...options,
    meta: { invalidates },
  });
}

export const seriesMutations = {
  useCreate: useCreateSeriesMutation,
  useUpdate: useUpdateSeriesMutation,
  useUpdateContentStructure: useUpdateSeriesContentStructureMutation,
};
