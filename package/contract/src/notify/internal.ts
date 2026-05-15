import { t } from "elysia";

/**
 * Broadcast-shaped event body for `POST /internal/event`.
 *
 * Recipient resolution happens on the caller (server) side — notify persists
 * one row per recipient and SSE-pushes to each connected recipient. The kind
 * is a dot-namespaced string validated against `KIND_REGISTRY` (server-side
 * before emit; notify re-validates as defense in depth).
 *
 * `sourceUnitId` is the Unit the event is "about" (the target of a reaction,
 * the followed user's Unit, the post that received a comment, etc.).
 */
export const internalBroadcastBodySchema = t.Object({
  kind: t.String({ minLength: 1, maxLength: 64 }),
  sourceUnitId: t.String(),
  recipientIds: t.Array(t.String()),
  actorId: t.Optional(t.Nullable(t.String())),
  extra: t.Optional(t.Any()),
});
export type InternalBroadcastBody =
  (typeof internalBroadcastBodySchema)["static"];

export const internalDmBodySchema = t.Object({
  senderId: t.String(),
  recipientId: t.String(),
  content: t.String({ minLength: 1 }),
});
export type InternalDmBody = (typeof internalDmBodySchema)["static"];
