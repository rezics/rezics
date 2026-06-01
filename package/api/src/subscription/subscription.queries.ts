import { queryOptions, useQuery } from "@tanstack/react-query";
import { subscriptionApi } from "./subscription.api";
import { subscriptionKeys } from "./subscription.keys";

/**
 * Query: my subscriptions (optionally filtered by subscribed unit type, e.g.
 * `'USER'` for the "followings" view).
 */
export const mySubscriptionsQuery = (filter?: { subscribedType?: string }) =>
  queryOptions({
    queryKey: subscriptionKeys.mine(filter),
    queryFn: () => subscriptionApi.listMine(filter),
    staleTime: 1000 * 30,
  });

export const subscriptionCheckQuery = (subscribedUnitId: string) =>
  queryOptions({
    queryKey: subscriptionKeys.check(subscribedUnitId),
    queryFn: () => subscriptionApi.check(subscribedUnitId),
    enabled: !!subscribedUnitId,
    staleTime: 1000 * 30,
  });

export const subscriberCountQuery = (subscribedUnitId: string) =>
  queryOptions({
    queryKey: subscriptionKeys.count(subscribedUnitId),
    queryFn: () => subscriptionApi.count(subscribedUnitId),
    enabled: !!subscribedUnitId,
    staleTime: 1000 * 30,
  });

export function useMySubscriptions(filter?: { subscribedType?: string }) {
  return useQuery(mySubscriptionsQuery(filter));
}

export function useIsSubscribed(subscribedUnitId: string) {
  return useQuery(subscriptionCheckQuery(subscribedUnitId));
}

export function useSubscriberCount(subscribedUnitId: string) {
  return useQuery(subscriberCountQuery(subscribedUnitId));
}

export const subscriptionQueries = {
  mine: mySubscriptionsQuery,
  check: subscriptionCheckQuery,
  count: subscriberCountQuery,
};
