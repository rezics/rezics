import { t } from "elysia";
import { notificationTypeSchema } from "./notification";

export const internalEventBodySchema = t.Object({
  recipientId: t.String(),
  type: notificationTypeSchema,
  actorId: t.Optional(t.Nullable(t.String())),
  entityType: t.String(),
  entityId: t.String(),
  meta: t.Optional(t.Any()),
});
export type InternalEventBody = (typeof internalEventBodySchema)["static"];

export const internalDmBodySchema = t.Object({
  senderId: t.String(),
  recipientId: t.String(),
  content: t.String({ minLength: 1 }),
});
export type InternalDmBody = (typeof internalDmBodySchema)["static"];
