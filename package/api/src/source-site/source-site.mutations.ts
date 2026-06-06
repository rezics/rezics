import type {
  CreateSourceSiteInput,
  SourceSiteDTO,
  UpdateSourceSiteInput,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { entityKeys } from "../entity/entity.keys";
import { sourceSiteApi } from "./source-site.api";
import { sourceSiteKeys } from "./source-site.keys";

export function invalidateSourceSiteQueries(
  queryClient: Pick<ReturnType<typeof useQueryClient>, "invalidateQueries">,
  entityUnitId?: string,
) {
  queryClient.invalidateQueries({ queryKey: sourceSiteKeys.lists() });
  if (entityUnitId) {
    queryClient.invalidateQueries({
      queryKey: sourceSiteKeys.detail(entityUnitId),
    });
    queryClient.invalidateQueries({
      queryKey: entityKeys.detail(entityUnitId),
    });
  }
}

export function useCreateSourceSite(
  options?: Omit<
    UseMutationOptions<SourceSiteDTO, Error, CreateSourceSiteInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateSourceSiteInput) => sourceSiteApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(sourceSiteKeys.detail(data.entityUnitId), data);
      invalidateSourceSiteQueries(queryClient, data.entityUnitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUpdateSourceSite(
  options?: Omit<
    UseMutationOptions<
      SourceSiteDTO,
      Error,
      { entityUnitId: string; input: UpdateSourceSiteInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ entityUnitId, input }) =>
      sourceSiteApi.update(entityUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      queryClient.setQueryData(sourceSiteKeys.detail(data.entityUnitId), data);
      invalidateSourceSiteQueries(queryClient, data.entityUnitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useDeleteSourceSite(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (entityUnitId: string) => sourceSiteApi.remove(entityUnitId),
    ...options,
    onSuccess: (data, entityUnitId, onMutateResult, context) => {
      queryClient.removeQueries({
        queryKey: sourceSiteKeys.detail(entityUnitId),
      });
      invalidateSourceSiteQueries(queryClient, entityUnitId);
      options?.onSuccess?.(data, entityUnitId, onMutateResult, context);
    },
  });
}

export const sourceSiteMutations = {
  useCreate: useCreateSourceSite,
  useUpdate: useUpdateSourceSite,
  useDelete: useDeleteSourceSite,
};
