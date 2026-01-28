import {t} from 'elysia';

export const NotificationTypeSchema = t.Union([
  t.Literal('REPLY'),
  t.Literal('MENTION'),
  t.Literal('REACTION'),
  t.Literal('FOLLOW'),
  t.Literal('SYSTEM'),
  t.Literal('UPDATE'),
]);
export type NotificationType = typeof NotificationTypeSchema.static;

export const NotificationEntityTypeSchema = t.Union([
  t.Literal('UNIT'),
  t.Literal('COMMENT'),
  t.Literal('USER'),
  t.Literal('FEEDBACK'),
  t.Literal('SYSTEM'),
]);
export type NotificationEntityType = typeof NotificationEntityTypeSchema.static;

export const CreateNotificationSchema = t.Object({
  userId: t.String({format: 'uuid'}),
  type: NotificationTypeSchema,
  actorId: t.Optional(t.String({format: 'uuid'})),
  entityType: NotificationEntityTypeSchema,
  entityId: t.String(),
  payload: t.Optional(t.Any()),
});
export type CreateNotification = typeof CreateNotificationSchema.static;

export const UserIdBodySchema = t.Object({
  userId: t.String({format: 'uuid'}),
});
export type UserIdBody = typeof UserIdBodySchema.static;

export const UnreadCountQuerySchema = t.Object({
  userId: t.String({format: 'uuid'}),
});
export type UnreadCountQuery = typeof UnreadCountQuerySchema.static;

export const MarkReadBodySchema = t.Object({
  userId: t.String({format: 'uuid'}),
  ids: t.Array(t.String({format: 'uuid'}), {minItems: 1}),
});
export type MarkReadBody = typeof MarkReadBodySchema.static;

export const ListNotificationsQuerySchema = t.Object({
  userId: t.String({format: 'uuid'}),
  limit: t.Optional(t.Integer({minimum: 1, maximum: 100, default: 50})),
  cursor: t.Optional(t.String()),
});
export type ListNotificationsQuery = typeof ListNotificationsQuerySchema.static;

export const NotificationSchema = t.Object({
  id: t.String(),
  userId: t.String(),
  type: NotificationTypeSchema,
  actorId: t.Optional(t.Union([t.String(), t.Null()])),
  entityType: NotificationEntityTypeSchema,
  entityId: t.String(),
  payload: t.Optional(t.Union([t.Any(), t.Null()])),
  createdAt: t.String(),
  readAt: t.Optional(t.Union([t.String(), t.Null()])),
  hiddenAt: t.Optional(t.Union([t.String(), t.Null()])),
});
export type Notification = typeof NotificationSchema.static;
