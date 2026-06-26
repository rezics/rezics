import {
  internalBroadcastBodySchema,
  internalDmBodySchema,
} from "@rezics/contract";
import { Elysia } from "elysia";
import { internalGuard } from "../macro/internal";
import {
  deliverInternalDm,
  emitInternalNotificationEvent,
} from "./internal.service";

export const internalApi = new Elysia({ prefix: "/internal" })
  .use(internalGuard)
  .post(
    "/event",
    async ({ body, set }) => {
      const result = await emitInternalNotificationEvent(body);
      if (!result.ok) set.status = result.status;
      return result.data;
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
      const result = await deliverInternalDm(body);
      if (!result.ok) set.status = result.status;
      return result.data;
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
