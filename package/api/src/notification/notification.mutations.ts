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
    // Spread caller options first so our onSuccess is not overwritten.
    // 先展开调用方选项，确保自定义 onSuccess 不会被覆盖。
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
      options?.onSuccess?.(...args);
    },
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
    // Spread caller options first so our onSuccess is not overwritten.
    // 先展开调用方选项，确保自定义 onSuccess 不会被覆盖。
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
      options?.onSuccess?.(...args);
    },
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
    // Spread caller options first so our onSuccess is not overwritten.
    // 先展开调用方选项，确保自定义 onSuccess 不会被覆盖。
    ...options,
    onSuccess: (...args) => {
      queryClient.invalidateQueries({ queryKey: notificationKeys.all() });
      options?.onSuccess?.(...args);
    },
  });
}

export const notificationMutations = {
  useMarkAsRead: useMarkAsReadMutation,
  useMarkAllAsRead: useMarkAllAsReadMutation,
  useDeleteNotification: useDeleteNotificationMutation,
};
