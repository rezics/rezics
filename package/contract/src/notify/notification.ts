import { t } from "elysia";
import { listGetQueryBase, listPostBodyBase } from "../list-query-base";

export const notificationExtraSchema = t.Optional(
  t.Object({
    unitTitle: t.Optional(t.String()),
    unitCover: t.Optional(t.String()),
    deepLink: t.Optional(t.String()),
  }),
);

export const notificationItemSchema = t.Object({
  id: t.String(),
  kind: t.String(),
  sourceUnitId: t.String(),
  actorIds: t.Array(t.String()),
  count: t.Number(),
  extra: t.Optional(t.Any()),
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
export type UnreadCountResponse = (typeof unreadCountResponseSchema)["static"];

export const markReadBodySchema = t.Object({
  kind: t.String({ minLength: 1, maxLength: 64 }),
  sourceUnitId: t.String(),
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

export const notificationRawEventSchema = t.Object({
  id: t.String(),
  kind: t.String(),
  sourceUnitId: t.String(),
  actorId: t.Nullable(t.String()),
  extra: t.Optional(t.Any()),
  createdAt: t.String(),
});
export type NotificationRawEvent =
  (typeof notificationRawEventSchema)["static"];
