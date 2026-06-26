import {
  internalBroadcastBodySchema,
  internalDmBodySchema,
  isValidKind,
} from "@rezics/contract";
import { Elysia } from "elysia";
import * as dmFanOut from "../dm/dm.fan-out";
import * as dmService from "../dm/dm.service";
import { internalGuard } from "../macro/internal";
import { broadcastNotifications } from "../notification/notification.service";
import { publish as publishSse } from "../stream/fan-out";

export const internalApi = new Elysia({ prefix: "/internal" })
  .use(internalGuard)
  .post(
    "/event",
    async ({ body, set }) => {
      if (!isValidKind(body.kind)) {
        set.status = 400;
        return { error: "Unknown notification kind", kind: body.kind };
      }

      const uniqueRecipients = Array.from(new Set(body.recipientIds));
      if (uniqueRecipients.length === 0) {
        return { success: true, persisted: 0 };
      }

      const rawEvents = await broadcastNotifications({
        kind: body.kind,
        sourceUnitId: body.sourceUnitId,
        recipientIds: uniqueRecipients,
        actorId: body.actorId ?? null,
        extra: body.extra,
      });

      for (const event of rawEvents) {
        try {
          publishSse(event.recipientId, event.raw);
        } catch (err) {
          // SSE failures are logged but do not fail persistence
          // SSE 失败会被记录，但不会导致持久化失败
          console.error(
            `[notify/internal/event] SSE push failed for ${event.recipientId}:`,
            err,
          );
        }
      }

      return { success: true, persisted: rawEvents.length };
    },
    {
      body: internalBroadcastBodySchema,
      detail: {
        summary: "Emit notification broadcast event",
        description:
          "Persists one notification row per recipient via createMany and fans out to each connected recipient via SSE.",
        tags: ["Internal"],
        security: [{ internalSecret: [] }],
      },
    },
  )
  .post(
    "/dm",
    async ({ body, set }) => {
      if (await dmService.isBlockedEitherWay(body.senderId, body.recipientId)) {
        set.status = 403;
        return { error: "Messaging is blocked between these users" };
      }

      const conversationId = await dmService.upsertConversation(
        body.senderId,
        body.recipientId,
      );

      const message = await dmService.insertMessage(
        conversationId,
        body.senderId,
        body.content,
      );

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
