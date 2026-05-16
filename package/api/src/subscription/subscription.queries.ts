import { queryOptions, useQuery } from "@tanstack/react-query";
import { subscriptionApi } from "./subscription.api";
import { subscriptionKeys } from "./subscription.keys";

/**
 * Query: my subscriptions (optionally filtered by target type, e.g.
 * `'USER'` for the "followings" view).
 */
export const mySubscriptionsQuery = (filter?: { targetType?: string }) =>
  queryOptions({
    queryKey: subscriptionKeys.mine(filter),
    queryFn: () => subscriptionApi.listMine(filter),
    staleTime: 1000 * 30,
  });

export const subscriptionCheckQuery = (targetUnitId: string) =>
  queryOptions({
    queryKey: subscriptionKeys.check(targetUnitId),
    queryFn: () => subscriptionApi.check(targetUnitId),
    enabled: !!targetUnitId,
    staleTime: 1000 * 30,
  });

export const subscriberCountQuery = (targetUnitId: string) =>
  queryOptions({
    queryKey: subscriptionKeys.count(targetUnitId),
    queryFn: () => subscriptionApi.count(targetUnitId),
    enabled: !!targetUnitId,
    staleTime: 1000 * 30,
  });

export function useMySubscriptions(filter?: { targetType?: string }) {
  return useQuery(mySubscriptionsQuery(filter));
}

export function useIsSubscribed(targetUnitId: string) {
  return useQuery(subscriptionCheckQuery(targetUnitId));
}

export function useSubscriberCount(targetUnitId: string) {
  return useQuery(subscriberCountQuery(targetUnitId));
}

export const subscriptionQueries = {
  mine: mySubscriptionsQuery,
  check: subscriptionCheckQuery,
  count: subscriberCountQuery,
};
