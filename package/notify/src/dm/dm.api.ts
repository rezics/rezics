import { dmMessageListQuerySchema } from "@rezics/contract";
import { Elysia, t } from "elysia";
import { authMacro, readCookie, verifyJwtToken } from "../macro/auth";
import * as dmFanOut from "./dm.fan-out";
import * as dmService from "./dm.service";

const SESSION_COOKIE_NAME = "rezics-session-token";

export const dmApi = new Elysia({ prefix: "/dm" })
  .use(authMacro)
  .get(
    "/conversations",
    async ({ userId }) => {
      const conversations = await dmService.getConversations(userId);
      return {
        conversations: conversations.map((c) => ({
          ...c,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        })),
      };
    },
    {
      requireUser: true,
      detail: {
        summary: "List conversations",
        description: "Returns all DM conversations for the authenticated user.",
        tags: ["Direct Messages"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    "/conversations/:id/messages",
    async ({ userId, params, query, set }) => {
      const page = Number(query.page ?? 1);
      const limit = Number(query.limit ?? 50);
      const result = await dmService.getMessages(
        params.id,
        userId,
        page,
        limit,
      );
      if (!result) {
        set.status = 404;
        return { error: "Conversation not found" };
      }

      // Mark messages as read when fetching
      await dmService.markMessagesAsRead(params.id, userId);

      return {
        messages: result.messages.map((m) => ({
          ...m,
          readAt: m.readAt?.toISOString() ?? null,
          createdAt: m.createdAt.toISOString(),
        })),
        total: result.total,
        page: result.page,
        limit: result.limit,
      };
    },
    {
      requireUser: true,
      params: t.Object({ id: t.String() }),
      query: dmMessageListQuerySchema,
      detail: {
        summary: "Get conversation messages",
        description:
          "Returns paginated messages for a conversation. Automatically marks messages as read.",
        tags: ["Direct Messages"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .ws("/ws", {
    detail: {
      summary: "DM WebSocket",
      description:
        "WebSocket connection for real-time DM delivery. " +
        "Authenticates via the `rezics-session-token` cookie sent on the upgrade request (under the `subdomain-trust-boundary` cookie scope). " +
        "This is a receive-only connection — client messages are ignored. " +
        "New messages are pushed as JSON frames.",
      tags: ["Direct Messages", "Realtime"],
    },
    async open(ws) {
      const cookieHeader = ws.data.request.headers.get("cookie") ?? undefined;
      const token = readCookie(cookieHeader, SESSION_COOKIE_NAME);
      if (!token) {
        ws.close(4001, "Missing session cookie");
        return;
      }

      const result = await verifyJwtToken(token);
      if (!result) {
        ws.close(4001, "Invalid token");
        return;
      }

      (ws.data as any).userId = result.userId;
      dmFanOut.subscribe(result.userId, ws);
    },
    message() {
      // Receive-only — ignore client messages
    },
    close(ws) {
      const userId = (ws.data as any).userId;
      if (userId) {
        dmFanOut.unsubscribe(userId, ws);
      }
    },
  });
