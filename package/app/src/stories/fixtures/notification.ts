// MOCK: Storybook notification fixtures, hand-authored against `NotificationItem`.
import type { NotificationItem } from "@rezics/contract";
import { NotificationType } from "@rezics/contract";

export const notificationLike: NotificationItem = {
  id: "notif-like",
  type: NotificationType.LIKE,
  entityType: "POST",
  entityId: "post-1",
  actorIds: ["user-ben", "user-cora", "user-dean"],
  count: 3,
  meta: { entityTitle: "Quiet endings, second readings" },
  read: false,
  latestAt: "2024-05-01T08:00:00.000Z",
};

export const notificationComment: NotificationItem = {
  id: "notif-comment",
  type: NotificationType.COMMENT,
  entityType: "POST",
  entityId: "post-2",
  actorIds: ["user-ben"],
  count: 1,
  meta: { entityTitle: "On long re-reads" },
  read: false,
  latestAt: "2024-05-02T11:00:00.000Z",
};

export const notificationFollow: NotificationItem = {
  id: "notif-follow",
  type: NotificationType.FOLLOW,
  entityType: "USER",
  entityId: "user-alice",
  actorIds: ["user-cora"],
  count: 1,
  read: true,
  latestAt: "2024-05-02T16:00:00.000Z",
};

export const notificationMention: NotificationItem = {
  id: "notif-mention",
  type: NotificationType.MENTION,
  entityType: "POST",
  entityId: "post-3",
  actorIds: ["user-ben"],
  count: 1,
  meta: { entityTitle: "Notes from tonight" },
  read: false,
  latestAt: "2024-05-02T19:00:00.000Z",
};

export const notificationSystem: NotificationItem = {
  id: "notif-system",
  type: NotificationType.SYSTEM,
  entityType: "SYSTEM",
  entityId: "system",
  actorIds: [],
  count: 1,
  meta: { entityTitle: "New feature: shared shelves" },
  read: true,
  latestAt: "2024-04-30T12:00:00.000Z",
};

export const notificationFavorite: NotificationItem = {
  id: "notif-favorite",
  type: NotificationType.FAVORITE,
  entityType: "SHELF",
  entityId: "shelf-1",
  actorIds: ["user-ben", "user-cora"],
  count: 2,
  meta: { entityTitle: "Reading queue" },
  read: false,
  latestAt: "2024-05-01T22:00:00.000Z",
};

export const notificationList: NotificationItem[] = [
  notificationLike,
  notificationComment,
  notificationMention,
  notificationFollow,
  notificationFavorite,
  notificationSystem,
];
