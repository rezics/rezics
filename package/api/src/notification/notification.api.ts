import type {
  MarkReadBody,
  NotificationListResponse,
  UnreadCountResponse,
} from "@rezics/contract";
import { notifyFetch } from "./notify-fetch";

export const notificationApi = {
  list: async (
    page: number,
    limit: number,
  ): Promise<NotificationListResponse> => {
    const search = new URLSearchParams({
      page: String(page),
      limit: String(limit),
    });
    return notifyFetch<NotificationListResponse>(
      `/notification/list?${search.toString()}`,
      { method: "GET" },
    );
  },

  unreadCount: async (): Promise<UnreadCountResponse> => {
    return notifyFetch<UnreadCountResponse>(`/notification/unread-count`, {
      method: "GET",
    });
  },

  markAsRead: async (input: MarkReadBody): Promise<{ success: true }> => {
    return notifyFetch<{ success: true }>(`/notification/read`, {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  markAllAsRead: async (): Promise<{ success: true }> => {
    return notifyFetch<{ success: true }>(`/notification/read-all`, {
      method: "POST",
    });
  },

  remove: async (id: string): Promise<{ success: true }> => {
    return notifyFetch<{ success: true }>(
      `/notification/${encodeURIComponent(id)}`,
      { method: "DELETE" },
    );
  },
};
