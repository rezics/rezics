import type {
  SubscriptionCreateBody,
  SubscriptionDTO,
  UserSubscriptionListEntryBatchReorderBody,
  UserSubscriptionListEntryDTO,
  UserSubscriptionListEntryPinBody,
  UserSubscriptionListEntryReorderBody,
} from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { cacheDomainKeys } from "../react-query/cache-coherence";
import { subscriptionApi } from "./subscription.api";
import { subscriptionKeys } from "./subscription.keys";

// Invalidation is declared via `meta.invalidates` (see `react-query/tsr.ts`):
// the global MutationCache handler refreshes these prefixes on success, so no
// mutation here needs `useQueryClient()` or a hand-wired `onSuccess`. The
// caller's own `onSuccess` therefore passes through untouched.
// 失效通过 `meta.invalidates` 声明（见 `react-query/tsr.ts`）：全局 MutationCache
// handler 在成功时刷新这些前缀，因此这里没有 mutation 需要 `useQueryClient()`
// 或手写 `onSuccess`。调用方自己的 `onSuccess` 因此原样透传。
//
// `follow` covers the subscribed target's check/count plus the follower's
// detail/profile surfaces; `entries` is the user's own subscription list. Both
// are prefix roots — `["subscription"]` already nests check/count/entries/mine.
// `follow` 覆盖被订阅目标的 check/count 以及关注者的 detail/profile 面；
// `entries` 是用户自己的订阅列表。两者都是前缀根——`["subscription"]` 已
// 嵌套 check/count/entries/mine。
const followInvalidates = cacheDomainKeys("follow");
const entriesInvalidates = [subscriptionKeys.all()];

export function useSubscribeMutation(
  options?: Omit<
    UseMutationOptions<SubscriptionDTO, Error, SubscriptionCreateBody>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: SubscriptionCreateBody) =>
      subscriptionApi.subscribe(input),
    ...options,
    meta: { invalidates: followInvalidates },
  });
}

export function useUnsubscribeMutation(
  options?: Omit<
    UseMutationOptions<{ unsubscribed: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (subscribedUnitId: string) =>
      subscriptionApi.unsubscribe(subscribedUnitId),
    ...options,
    meta: { invalidates: followInvalidates },
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
  return useMutation({
    mutationFn: ({ subscribedUnitId, channels }) =>
      subscriptionApi.updateChannels(subscribedUnitId, { channels }),
    ...options,
    meta: { invalidates: followInvalidates },
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
  return useMutation({
    mutationFn: ({ subscribedUnitId, input }) =>
      subscriptionApi.pinEntry(subscribedUnitId, input),
    ...options,
    meta: { invalidates: entriesInvalidates },
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
  return useMutation({
    mutationFn: ({ subscribedUnitId, input }) =>
      subscriptionApi.reorderEntry(subscribedUnitId, input),
    ...options,
    meta: { invalidates: entriesInvalidates },
  });
}

export function useReorderSubscriptionListEntriesMutation(
  options?: Omit<
    UseMutationOptions<
      UserSubscriptionListEntryDTO[],
      Error,
      UserSubscriptionListEntryBatchReorderBody
    >,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (input: UserSubscriptionListEntryBatchReorderBody) =>
      subscriptionApi.reorderEntries(input),
    ...options,
    meta: { invalidates: entriesInvalidates },
  });
}

export function useRemoveSubscriptionListEntryMutation(
  options?: Omit<
    UseMutationOptions<{ removed: boolean }, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (subscribedUnitId: string) =>
      subscriptionApi.removeEntry(subscribedUnitId),
    ...options,
    meta: { invalidates: entriesInvalidates },
  });
}

export function useRecoverSubscriptionListEntryMutation(
  options?: Omit<
    UseMutationOptions<UserSubscriptionListEntryDTO, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    mutationFn: (subscribedUnitId: string) =>
      subscriptionApi.recoverEntry(subscribedUnitId),
    ...options,
    meta: { invalidates: followInvalidates },
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
  useReorderEntries: useReorderSubscriptionListEntriesMutation,
  useRemoveEntry: useRemoveSubscriptionListEntryMutation,
  useRecoverEntry: useRecoverSubscriptionListEntryMutation,
};
