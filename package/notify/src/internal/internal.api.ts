import { internalDmBodySchema, internalEventBodySchema } from "@rezics/contract";
import { Elysia } from "elysia";
import * as dmFanOut from "../dm/dm.fan-out";
import * as dmService from "../dm/dm.service";
import { internalGuard } from "../macro/internal";
import { mapNotificationToRawEvent } from "../notification/notification.mapper";
import { createNotification } from "../notification/notification.service";
import { publish as publishSse } from "../stream/fan-out";

export const internalApi = new Elysia({ prefix: "/internal" })
  .use(internalGuard)
  .post(
    "/event",
    async ({ body }) => {
      const notification = await createNotification({
        recipientId: body.recipientId,
        actorId: body.actorId,
        type: body.type,
        entityType: body.entityType,
        entityId: body.entityId,
        meta: body.meta,
      });

      // Fan-out to SSE if recipient is connected
      publishSse(
        body.recipientId,
        mapNotificationToRawEvent(notification),
      );

      return { success: true, id: notification.id };
    },
    {
      body: internalEventBodySchema,
      detail: {
        summary: "Emit notification event",
        description:
          "Creates a notification and fans out to the recipient via SSE if connected.",
        tags: ["Internal"],
        security: [{ internalSecret: [] }],
      },
    },
  )
  .post(
    "/dm",
    async ({ body }) => {
      const conversationId = await dmService.upsertConversation(
        body.senderId,
        body.recipientId,
      );

      const message = await dmService.insertMessage(
        conversationId,
        body.senderId,
        body.content,
      );

      // Fan-out to recipient's WebSocket connections
      dmFanOut.publish(body.recipientId, {
        id: message.id,
        conversationId,
        senderId: body.senderId,
        content: body.content,
        readAt: null,
        createdAt: message.createdAt.toISOString(),
      });

      return { success: true, messageId: message.id, conversationId };
    },
    {
      body: internalDmBodySchema,
      detail: {
        summary: "Send DM (internal)",
        description:
          "Creates or upserts a conversation and inserts a message. Fans out to the recipient's WebSocket connections.",
        tags: ["Internal"],
        security: [{ internalSecret: [] }],
      },
    },
  );
