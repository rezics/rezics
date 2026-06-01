import type { SubscriptionCreateBody, SubscriptionDTO } from "@rezics/contract";
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

// Conventional hook names exposed under the subscription namespace.
// `useSubscribe` and `useUnsubscribe` default to channels=['*'] (full
// subscription) — the channel-picker UI passes explicit channels to
// `useUpdateSubscriptionChannels` after the initial subscribe.
export const useSubscribe = useSubscribeMutation;
export const useUnsubscribe = useUnsubscribeMutation;
export const useUpdateSubscriptionChannels =
  useUpdateSubscriptionChannelsMutation;

export const subscriptionMutations = {
  useSubscribe: useSubscribeMutation,
  useUnsubscribe: useUnsubscribeMutation,
  useUpdateChannels: useUpdateSubscriptionChannelsMutation,
};
