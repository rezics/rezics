import type {
  CreateZoneInput,
  CreateZonePageInput,
  UpdateZoneInput,
  UpdateZoneBoundaryInput,
  UpdateZoneNavInput,
  UpdateZonePageInput,
  UpdateZoneThemeInput,
  ZoneDTO,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { zoneApi } from "./zone.api";
import { zoneKeys } from "./zone.keys";

// Every zone write refreshes all zone-shaped queries (detail, portal,
// sections) — a config change can touch any section's data. Declared once via
// `meta.invalidates` (see `react-query/tsr.ts`); the global MutationCache
// handler runs it, so no mutation hand-wires `useQueryClient()`/`onSuccess`.
// 每次专区写入都刷新所有专区形态的查询（详情、门户、分区）——配置更新可能
// 触及任何分区的数据。通过 `meta.invalidates` 声明一次（见 `react-query/tsr.ts`），
// 全局 MutationCache handler 执行它，因此没有 mutation 手写
// `useQueryClient()`/`onSuccess`。
const zoneInvalidates = { invalidates: [zoneKeys.details()] };

export function useCreateZone(
  options?: Omit<
    UseMutationOptions<ZoneDTO, Error, CreateZoneInput>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: CreateZoneInput) => zoneApi.create(input),
    ...options,
    meta: zoneInvalidates,
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
  return useMutation({
    mutationFn: ({ unitId, input }) => zoneApi.update(unitId, input),
    ...options,
    meta: zoneInvalidates,
  });
}

export function useUpdateZoneBoundary(
  options?: Omit<
    UseMutationOptions<
      ZoneDTO,
      Error,
      { unitId: string; input: UpdateZoneBoundaryInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, input }) => zoneApi.updateBoundary(unitId, input),
    ...options,
    meta: zoneInvalidates,
  });
}

export function useUpdateZoneNav(
  options?: Omit<
    UseMutationOptions<
      ZoneDTO,
      Error,
      { unitId: string; input: UpdateZoneNavInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, input }) => zoneApi.updateNav(unitId, input),
    ...options,
    meta: zoneInvalidates,
  });
}

export function useUpdateZoneTheme(
  options?: Omit<
    UseMutationOptions<
      ZoneDTO,
      Error,
      { unitId: string; input: UpdateZoneThemeInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, input }) => zoneApi.updateTheme(unitId, input),
    ...options,
    meta: zoneInvalidates,
  });
}

export function useCreateZonePage(
  options?: Omit<
    UseMutationOptions<
      ZoneDTO,
      Error,
      { unitId: string; input: CreateZonePageInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, input }) => zoneApi.createPage(unitId, input),
    ...options,
    meta: zoneInvalidates,
  });
}

export function useUpdateZonePage(
  options?: Omit<
    UseMutationOptions<
      ZoneDTO,
      Error,
      { unitId: string; pageId: string; input: UpdateZonePageInput }
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, pageId, input }) =>
      zoneApi.updatePage(unitId, pageId, input),
    ...options,
    meta: zoneInvalidates,
  });
}

export function useDeleteZonePage(
  options?: Omit<
    UseMutationOptions<ZoneDTO, Error, { unitId: string; pageId: string }>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: ({ unitId, pageId }) => zoneApi.deletePage(unitId, pageId),
    ...options,
    meta: zoneInvalidates,
  });
}

export function useDeleteZone(
  options?: Omit<
    UseMutationOptions<{ message: string }, Error, string>,
    "mutationFn"
  >,
) {
  // Delete also drops the removed zone's exact cache entry, which is
  // variable-dependent and cannot be declared statically — so this one keeps
  // an `onSuccess` for `removeQueries` while the invalidate runs from meta.
  // 删除还会丢弃被删专区的精确缓存项，这依赖变量、无法静态声明——因此这一个
  // 保留 `onSuccess` 处理 `removeQueries`，而失效仍由 meta 执行。
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (unitId: string) => zoneApi.remove(unitId),
    ...options,
    meta: zoneInvalidates,
    onSuccess: (data, unitId, onMutateResult, context) => {
      queryClient.removeQueries({ queryKey: zoneKeys.byUnitId(unitId) });
      options?.onSuccess?.(data, unitId, onMutateResult, context);
    },
  });
}

export const zoneMutations = {
  useCreate: useCreateZone,
  useUpdate: useUpdateZone,
  useUpdateBoundary: useUpdateZoneBoundary,
  useUpdateNav: useUpdateZoneNav,
  useUpdateTheme: useUpdateZoneTheme,
  useCreatePage: useCreateZonePage,
  useUpdatePage: useUpdateZonePage,
  useDeletePage: useDeleteZonePage,
  useDelete: useDeleteZone,
};
