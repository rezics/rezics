import type {
  ContentStructureItem,
  ContentStructureResponse,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { contentStructureApi } from "./content-structure.api";
import { contentStructureKeys } from "./content-structure.keys";

// ponytail: root prefix; per-owner granularity if perf matters
const invalidates = [contentStructureKeys.all()];

export function useUpdateContentStructureMutation(
  options?: Omit<
    UseMutationOptions<
      ContentStructureResponse,
      Error,
      { ownerUnitId: string; nodes: ContentStructureItem[] }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ ownerUnitId, nodes }) =>
      contentStructureApi.update(ownerUnitId, nodes),
    ...options,
    meta: { invalidates },
  });
}

export function useRestoreContentStructureNodes(
  ownerUnitId: string,
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string[]>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (nodeIds: string[]) =>
      contentStructureApi.restore(ownerUnitId, nodeIds),
    ...options,
    meta: { invalidates },
  });
}

export const contentStructureMutations = {
  useUpdate: useUpdateContentStructureMutation,
  useRestore: useRestoreContentStructureNodes,
};
