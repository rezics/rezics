import type { MarkReadBody } from "@rezics/contract";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { notificationApi } from "./notification.api";
import { notificationKeys } from "./notification.keys";

export function useMarkAsReadMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, MarkReadBody>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: (input: MarkReadBody) => notificationApi.markAsRead(input),
    // ponytail: root prefix; covers list + unreadCount
    meta: { invalidates: [notificationKeys.all()] },
  });
}

export function useMarkAllAsReadMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, void>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: () => notificationApi.markAllAsRead(),
    // ponytail: root prefix; covers list + unreadCount
    meta: { invalidates: [notificationKeys.all()] },
  });
}

export function useDeleteNotificationMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, string>,
    "mutationFn"
  >,
) {
  return useMutation({
    ...options,
    mutationFn: (id: string) => notificationApi.remove(id),
    // ponytail: root prefix; covers list + unreadCount
    meta: { invalidates: [notificationKeys.all()] },
  });
}

export const notificationMutations = {
  useMarkAsRead: useMarkAsReadMutation,
  useMarkAllAsRead: useMarkAllAsReadMutation,
  useDeleteNotification: useDeleteNotificationMutation,
};
