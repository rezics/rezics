import type {
  SubscriptionCreateBody,
  SubscriptionDTO,
  UserSubscriptionListEntryDTO,
  UserSubscriptionListEntryPinBody,
  UserSubscriptionListEntryReorderBody,
} from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { invalidateForCacheDomain } from "../react-query/cache-coherence";
import { subscriptionApi } from "./subscription.api";
import { subscriptionKeys } from "./subscription.keys";

function invalidateForTarget(
  qc: ReturnType<typeof useQueryClient>,
  subscribedUnitId: string,
) {
  qc.invalidateQueries({ queryKey: subscriptionKeys.check(subscribedUnitId) });
  qc.invalidateQueries({ queryKey: subscriptionKeys.count(subscribedUnitId) });
  qc.invalidateQueries({ queryKey: subscriptionKeys.all() });
  void invalidateForCacheDomain(qc, "follow");
}

function invalidateEntries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: subscriptionKeys.all() });
}

export function useSubscribeMutation(
  options?: Omit<
    UseMutationOptions<SubscriptionDTO, Error, SubscriptionCreateBody>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: SubscriptionCreateBody) =>
      subscriptionApi.subscribe(input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateForTarget(qc, variables.subscribedUnitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useUnsubscribeMutation(
  options?: Omit<
    UseMutationOptions<{ unsubscribed: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscribedUnitId: string) =>
      subscriptionApi.unsubscribe(subscribedUnitId),
    ...options,
    onSuccess: (data, subscribedUnitId, onMutateResult, context) => {
      invalidateForTarget(qc, subscribedUnitId);
      options?.onSuccess?.(data, subscribedUnitId, onMutateResult, context);
    },
  });
}

export function useUpdateSubscriptionChannelsMutation(
  options?: Omit<
    UseMutationOptions<
      SubscriptionDTO,
      Error,
      { subscribedUnitId: string; channels: string[] }
    >,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subscribedUnitId, channels }) =>
      subscriptionApi.updateChannels(subscribedUnitId, { channels }),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateForTarget(qc, variables.subscribedUnitId);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function usePinSubscriptionListEntryMutation(
  options?: Omit<
    UseMutationOptions<
      UserSubscriptionListEntryDTO,
      Error,
      { subscribedUnitId: string; input: UserSubscriptionListEntryPinBody }
    >,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subscribedUnitId, input }) =>
      subscriptionApi.pinEntry(subscribedUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateEntries(qc);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useReorderSubscriptionListEntryMutation(
  options?: Omit<
    UseMutationOptions<
      UserSubscriptionListEntryDTO,
      Error,
      { subscribedUnitId: string; input: UserSubscriptionListEntryReorderBody }
    >,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ subscribedUnitId, input }) =>
      subscriptionApi.reorderEntry(subscribedUnitId, input),
    ...options,
    onSuccess: (data, variables, onMutateResult, context) => {
      invalidateEntries(qc);
      options?.onSuccess?.(data, variables, onMutateResult, context);
    },
  });
}

export function useRemoveSubscriptionListEntryMutation(
  options?: Omit<
    UseMutationOptions<{ removed: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscribedUnitId: string) =>
      subscriptionApi.removeEntry(subscribedUnitId),
    ...options,
    onSuccess: (data, subscribedUnitId, onMutateResult, context) => {
      invalidateEntries(qc);
      options?.onSuccess?.(data, subscribedUnitId, onMutateResult, context);
    },
  });
}

export function useRecoverSubscriptionListEntryMutation(
  options?: Omit<
    UseMutationOptions<UserSubscriptionListEntryDTO, Error, string>,
    "mutationFn"
  >,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (subscribedUnitId: string) =>
      subscriptionApi.recoverEntry(subscribedUnitId),
    ...options,
    onSuccess: (data, subscribedUnitId, onMutateResult, context) => {
      invalidateForTarget(qc, subscribedUnitId);
      options?.onSuccess?.(data, subscribedUnitId, onMutateResult, context);
    },
  });
}

// Conventional hook names exposed under the subscription namespace.
// `useSubscribe` and `useUnsubscribe` default to channels=['*'] (full
// subscription) — the channel-picker UI passes explicit channels to
// `useUpdateSubscriptionChannels` after the initial subscribe.
// 在 subscription 命名空间下暴露的约定式 hook 名称。
// `useSubscribe` 和 `useUnsubscribe` 默认 channels=['*']（完整订阅）——
// 频道选择器 UI 在初次订阅后通过 `useUpdateSubscriptionChannels` 传入显式频道。
export const useSubscribe = useSubscribeMutation;
export const useUnsubscribe = useUnsubscribeMutation;
export const useUpdateSubscriptionChannels =
  useUpdateSubscriptionChannelsMutation;

export const subscriptionMutations = {
  useSubscribe: useSubscribeMutation,
  useUnsubscribe: useUnsubscribeMutation,
  useUpdateChannels: useUpdateSubscriptionChannelsMutation,
  usePinEntry: usePinSubscriptionListEntryMutation,
  useReorderEntry: useReorderSubscriptionListEntryMutation,
  useRemoveEntry: useRemoveSubscriptionListEntryMutation,
  useRecoverEntry: useRecoverSubscriptionListEntryMutation,
};
