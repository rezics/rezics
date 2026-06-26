import {
  type InternalBroadcastBody,
  type InternalDmBody,
  isValidKind,
} from "@rezics/contract";
import * as dmFanOut from "../dm/dm.fan-out";
import * as dmService from "../dm/dm.service";
import { broadcastNotifications } from "../notification/notification.service";
import { publish as publishSse } from "../stream/fan-out";

type InternalSuccess<T extends object> = {
  ok: true;
  status: 200;
  data: T;
};

type InternalFailure<T extends object> = {
  ok: false;
  status: 400 | 403;
  data: T;
};

export type InternalNotifyResult<
  TSuccess extends object,
  TFailure extends object,
> = InternalSuccess<TSuccess> | InternalFailure<TFailure>;

export async function emitInternalNotificationEvent(
  body: InternalBroadcastBody,
): Promise<
  InternalNotifyResult<
    { success: true; persisted: number },
    { error: string; kind?: string }
  >
> {
  if (!isValidKind(body.kind)) {
    return {
      ok: false,
      status: 400,
      data: { error: "Unknown notification kind", kind: body.kind },
    };
  }

  const uniqueRecipients = Array.from(new Set(body.recipientIds));
  if (uniqueRecipients.length === 0) {
    return { ok: true, status: 200, data: { success: true, persisted: 0 } };
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

  return {
    ok: true,
    status: 200,
    data: { success: true, persisted: rawEvents.length },
  };
}

export async function deliverInternalDm(
  body: InternalDmBody,
): Promise<
  InternalNotifyResult<
    { success: true; messageId: string; conversationId: string },
    { error: string }
  >
> {
  if (await dmService.isBlockedEitherWay(body.senderId, body.recipientId)) {
    return {
      ok: false,
      status: 403,
      data: { error: "Messaging is blocked between these users" },
    };
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

  return {
    ok: true,
    status: 200,
    data: { success: true, messageId: message.id, conversationId },
  };
}
