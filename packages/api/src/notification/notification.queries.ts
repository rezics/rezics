import { queryOptions, useQuery } from "@tanstack/react-query";
import { notificationApi } from "./notification.api";
import { notificationKeys } from "./notification.keys";

const DEFAULT_LIMIT = 20;

export const notificationQueryOptions = {
  list: (page = 1, limit = DEFAULT_LIMIT) =>
    queryOptions({
      queryKey: notificationKeys.list(page, limit),
      queryFn: () => notificationApi.list(page, limit),
    }),
  unreadCount: () =>
    queryOptions({
      queryKey: notificationKeys.unreadCount(),
      queryFn: () => notificationApi.unreadCount(),
    }),
};

export function useNotifications(page = 1, limit = DEFAULT_LIMIT) {
  return useQuery(notificationQueryOptions.list(page, limit));
}

export function useUnreadCount() {
  return useQuery(notificationQueryOptions.unreadCount());
}

export const notificationQueries = {
  useNotifications,
  useUnreadCount,
};
