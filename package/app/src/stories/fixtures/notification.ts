// MOCK: Storybook notification fixtures, hand-authored against `NotificationItem`.
import type { NotificationItem } from "@rezics/contract";

export const notificationUpvote: NotificationItem = {
  id: "reaction.upvote:post-1",
  kind: "reaction.upvote",
  sourceUnitId: "post-1",
  actorIds: ["user-ben", "user-cora", "user-dean"],
  count: 3,
  extra: { unitTitle: "Quiet endings, second readings" },
  read: false,
  latestAt: "2024-05-01T08:00:00.000Z",
};

export const notificationComment: NotificationItem = {
  id: "notif-comment",
  kind: "comment.new",
  sourceUnitId: "post-2",
  actorIds: ["user-ben"],
  count: 1,
  extra: { unitTitle: "On long re-reads" },
  read: false,
  latestAt: "2024-05-02T11:00:00.000Z",
};

export const notificationFollow: NotificationItem = {
  id: "follow.new:user-alice",
  kind: "follow.new",
  sourceUnitId: "user-alice",
  actorIds: ["user-cora"],
  count: 1,
  read: true,
  latestAt: "2024-05-02T16:00:00.000Z",
};

export const notificationMention: NotificationItem = {
  id: "notif-mention",
  kind: "mention.new",
  sourceUnitId: "post-3",
  actorIds: ["user-ben"],
  count: 1,
  extra: { unitTitle: "Notes from tonight" },
  read: false,
  latestAt: "2024-05-02T19:00:00.000Z",
};

export const notificationSystem: NotificationItem = {
  id: "notif-system",
  kind: "system.notice",
  sourceUnitId: "system",
  actorIds: [],
  count: 1,
  extra: { unitTitle: "New feature: shared shelves" },
  read: true,
  latestAt: "2024-04-30T12:00:00.000Z",
};

export const notificationFavorite: NotificationItem = {
  id: "reaction.favorite:shelf-1",
  kind: "reaction.favorite",
  sourceUnitId: "shelf-1",
  actorIds: ["user-ben", "user-cora"],
  count: 2,
  extra: { unitTitle: "Reading queue" },
  read: false,
  latestAt: "2024-05-01T22:00:00.000Z",
};

export const notificationList: NotificationItem[] = [
  notificationUpvote,
  notificationComment,
  notificationMention,
  notificationFollow,
  notificationFavorite,
  notificationSystem,
];
