import { t } from "elysia";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";

export const NotificationType = {
  LIKE: "LIKE",
  FAVORITE: "FAVORITE",
  FOLLOW: "FOLLOW",
  COMMENT: "COMMENT",
  MENTION: "MENTION",
  SYSTEM: "SYSTEM",
  INVITATION: "INVITATION",
} as const;
export type NotificationType =
  (typeof NotificationType)[keyof typeof NotificationType];

export const notificationTypeSchema = t.Union([
  t.Literal(NotificationType.LIKE),
  t.Literal(NotificationType.FAVORITE),
  t.Literal(NotificationType.FOLLOW),
  t.Literal(NotificationType.COMMENT),
  t.Literal(NotificationType.MENTION),
  t.Literal(NotificationType.SYSTEM),
  t.Literal(NotificationType.INVITATION),
]);

/** Types that aggregate by entity (group multiple actors). */
export const AGGREGATABLE_TYPES: ReadonlySet<NotificationType> = new Set([
  NotificationType.LIKE,
  NotificationType.FAVORITE,
  NotificationType.FOLLOW,
]);

export const notificationMetaSchema = t.Optional(
  t.Object({
    entityTitle: t.Optional(t.String()),
    entityCover: t.Optional(t.String()),
  }),
);

export const notificationItemSchema = t.Object({
  id: t.String(),
  type: notificationTypeSchema,
  entityType: t.String(),
  entityId: t.String(),
  actorIds: t.Array(t.String()),
  count: t.Number(),
  meta: t.Optional(t.Any()),
  read: t.Boolean(),
  latestAt: t.String(),
});
export type NotificationItem = (typeof notificationItemSchema)["static"];

export const notificationListResponseSchema = t.Object({
  items: t.Array(notificationItemSchema),
  total: t.Number(),
  page: t.Number(),
  limit: t.Number(),
});
export type NotificationListResponse =
  (typeof notificationListResponseSchema)["static"];

export const unreadCountResponseSchema = t.Object({
  count: t.Number(),
});
export type UnreadCountResponse =
  (typeof unreadCountResponseSchema)["static"];

export const markReadBodySchema = t.Object({
  type: notificationTypeSchema,
  entityType: t.String(),
  entityId: t.String(),
});
export type MarkReadBody = (typeof markReadBodySchema)["static"];

export const notificationListQuerySchema = t.Object({
  ...listGetQueryBase.properties,
  page: t.Optional(t.Numeric({ default: 1 })),
  limit: t.Optional(t.Numeric({ default: 20 })),
});
export type NotificationListQuery =
  (typeof notificationListQuerySchema)["static"];

export const notificationListBodySchema = t.Object({
  ...listPostBodyBase.properties,
  page: t.Optional(t.Numeric({ default: 1 })),
  limit: t.Optional(t.Numeric({ default: 20 })),
});
export type NotificationListBody =
  (typeof notificationListBodySchema)["static"];
