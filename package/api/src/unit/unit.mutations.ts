/**
 * React Query mutations for Unit operations
 * 用于 Unit 操作的 React Query mutations
 */

import type {
  CreateUnitInput,
  EditorialPatchSubmission,
  UnitResponse,
  UnitTranslationDTO,
  UpdateTranslationInput,
  UpdateUnitInput,
} from "@rezics/contract";
import {
  type QueryClient,
  type QueryKey,
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import {
  patchTranslationDetailQueries,
  removeTranslationFromDetailQueries,
} from "../react-query/cache-coherence";
import { unitApi } from "./unit.api";
import { unitKeys } from "./unit.keys";

type UpsertTranslationVariables = {
  unitId: string;
  language: string;
  input: UpdateTranslationInput | EditorialPatchSubmission;
};

type DeleteTranslationVariables = {
  unitId: string;
  language: string;
};

interface AffectedDetailKeysOption<TData, TVariables> {
  affectedDetailKeys?: (
    variables: TVariables,
    data: TData,
  ) => readonly QueryKey[];
}

type UpsertTranslationMutationOptions = Omit<
  UseMutationOptions<UnitTranslationDTO, Error, UpsertTranslationVariables>,
  "mutationFn"
> &
  AffectedDetailKeysOption<UnitTranslationDTO, UpsertTranslationVariables>;

type DeleteTranslationMutationOptions = Omit<
  UseMutationOptions<{ message: string }, Error, DeleteTranslationVariables>,
  "mutationFn"
> &
  AffectedDetailKeysOption<{ message: string }, DeleteTranslationVariables>;

export async function syncUpsertTranslationMutationCache({
  queryClient,
  variables,
  data,
  affectedDetailKeys,
}: {
  queryClient: QueryClient;
  variables: UpsertTranslationVariables;
  data: UnitTranslationDTO;
  affectedDetailKeys?: UpsertTranslationMutationOptions["affectedDetailKeys"];
}) {
  const detailKeys = affectedDetailKeys?.(variables, data) ?? [];
  await patchTranslationDetailQueries({
    queryClient,
    detailKeys,
    translation: data,
  });
  queryClient.invalidateQueries({
    queryKey: unitKeys.detail(variables.unitId),
  });
  queryClient.invalidateQueries({ queryKey: unitKeys.lists() });
}

export async function syncDeleteTranslationMutationCache({
  queryClient,
  variables,
  data,
  affectedDetailKeys,
}: {
  queryClient: QueryClient;
  variables: DeleteTranslationVariables;
  data: { message: string };
  affectedDetailKeys?: DeleteTranslationMutationOptions["affectedDetailKeys"];
}) {
  const detailKeys = affectedDetailKeys?.(variables, data) ?? [];
  await removeTranslationFromDetailQueries({
    queryClient,
    detailKeys,
    language: variables.language,
  });
  queryClient.invalidateQueries({
    queryKey: unitKeys.detail(variables.unitId),
  });
  queryClient.invalidateQueries({ queryKey: unitKeys.lists() });
}

/**
 * Mutation for creating a unit
 * 用于创建 unit 的 mutation
 */
export function useCreateUnitMutation(
  options?: Omit<
    UseMutationOptions<UnitResponse, Error, CreateUnitInput>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateUnitInput) => unitApi.create(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Invalidate and refetch unit lists
      // 使 unit 列表失效并重新拉取
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });

      // Pre-populate the cache with the new unit
      // 用新建的 unit 预填充缓存
      if (data?.id) {
        queryClient.setQueryData(unitKeys.detail(data.id), data);
      }

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for updating a unit
 * 用于更新 unit 的 mutation
 */
export function useUpdateUnitMutation(
  options?: Omit<
    UseMutationOptions<
      UnitResponse,
      Error,
      { unitId: string; input: UpdateUnitInput }
    >,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ unitId, input }) => unitApi.update(unitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      // Update the cache for this specific unit
      // 更新该 unit 对应的缓存
      queryClient.setQueryData(unitKeys.detail(variables.unitId), data);

      // Invalidate lists to ensure they're refreshed
      // 使列表失效以确保其刷新
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });

      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a unit
 * 用于删除 unit 的 mutation
 */
export function useDeleteUnitMutation(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (unitId: string) => unitApi.remove(unitId),
    ...options,
    onSuccess: (data, unitId, onMutateResult, context) => {
      // Remove from cache
      // 从缓存中移除
      queryClient.removeQueries({ queryKey: unitKeys.detail(unitId) });

      // Invalidate all lists
      // 使所有列表失效
      queryClient.invalidateQueries({ queryKey: unitKeys.lists() });

      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

/**
 * Mutation for upserting a translation row on a unit
 * 用于在 unit 上 upsert 一行翻译的 mutation
 */
export function useUpsertTranslationMutation(
  options?: UpsertTranslationMutationOptions,
) {
  const queryClient = useQueryClient();
  const { affectedDetailKeys, ...mutationOptions } = options ?? {};

  return useMutation({
    mutationFn: ({ unitId, language, input }) =>
      unitApi.upsertTranslation(unitId, language, input),
    ...mutationOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await syncUpsertTranslationMutationCache({
        queryClient,
        variables,
        data,
        affectedDetailKeys,
      });
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Mutation for deleting a translation row on a unit
 * 用于删除 unit 上一行翻译的 mutation
 */
export function useDeleteTranslationMutation(
  options?: DeleteTranslationMutationOptions,
) {
  const queryClient = useQueryClient();
  const { affectedDetailKeys, ...mutationOptions } = options ?? {};

  return useMutation({
    mutationFn: ({ unitId, language }) =>
      unitApi.deleteTranslation(unitId, language),
    ...mutationOptions,
    onSuccess: async (data, variables, onMutateResult, context) => {
      await syncDeleteTranslationMutationCache({
        queryClient,
        variables,
        data,
        affectedDetailKeys,
      });
      await options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

/**
 * Combined mutations export
 * 组合后的 mutations 导出
 */
export const unitMutations = {
  useCreate: useCreateUnitMutation,
  useUpdate: useUpdateUnitMutation,
  useDelete: useDeleteUnitMutation,
  useUpsertTranslation: useUpsertTranslationMutation,
  useDeleteTranslation: useDeleteTranslationMutation,
};
