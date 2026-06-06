import type { MarkReadBody } from "@rezics/contract";
import {
  type UseMutationOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { notificationApi } from "./notification.api";
import { notificationKeys } from "./notification.keys";

export function useMarkAsReadMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, MarkReadBody>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: MarkReadBody) => notificationApi.markAsRead(input),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useMarkAllAsReadMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, void>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationApi.markAllAsRead(),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export function useDeleteNotificationMutation(
  options?: Omit<
    UseMutationOptions<{ success: true }, Error, string>,
    "mutationFn"
  >,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationApi.remove(id),
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
      options?.onSuccess?.(...args);
    },
    ...options,
  });
}

export const notificationMutations = {
  useMarkAsRead: useMarkAsReadMutation,
  useMarkAllAsRead: useMarkAllAsReadMutation,
  useDeleteNotification: useDeleteNotificationMutation,
};
