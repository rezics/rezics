export const notificationKeys = {
  all: () => ["notifications"] as const,
  list: (page: number, limit: number) =>
    [...notificationKeys.all(), "list", page, limit] as const,
  unreadCount: () => [...notificationKeys.all(), "unread-count"] as const,
} as const;
