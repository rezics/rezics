import {
  dmBlockPeerBodySchema,
  dmMessageListQuerySchema,
} from "@rezics/contract";
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
      const enriched = await Promise.all(
        conversations.map(async (c) => {
          const peerId =
            c.participantA === userId ? c.participantB : c.participantA;
          const viewer = await dmService.getConversationViewerState(
            c.id,
            userId,
            peerId,
          );
          return {
            ...c,
            createdAt: c.createdAt.toISOString(),
            updatedAt: c.updatedAt.toISOString(),
            unreadCount: viewer.unreadCount,
            peerBlocked: viewer.peerBlocked,
            blockedByPeer: viewer.blockedByPeer,
          };
        }),
      );
      return { conversations: enriched };
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
      // 拉取时将消息标记为已读
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
  .post(
    "/conversations/:id/read",
    async ({ userId, params, body, set }) => {
      const receipt = await dmService.markReadUpTo(
        params.id,
        userId,
        body.upToMessageId,
      );
      if (!receipt) {
        set.status = 404;
        return { error: "Conversation or message not found" };
      }
      const peerId = await dmService.getPeerId(params.id, userId);
      if (peerId) {
        // Tell the peer their messages were read (their sent-message receipts).
        // 告知对端其消息已被阅读（对端已发送消息的回执）。
        dmFanOut.publish(peerId, {
          kind: "dm.read",
          conversationId: params.id,
          readAt: receipt.readAt,
        });
      }
      return receipt;
    },
    {
      requireUser: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({ upToMessageId: t.String() }),
      detail: {
        summary: "Mark messages read",
        description:
          "Marks the peer's messages up to `upToMessageId` as read and emits a read receipt to the peer.",
        tags: ["Direct Messages"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    "/conversations/:id/typing",
    async ({ userId, params, body, set }) => {
      const peerId = await dmService.getPeerId(params.id, userId);
      if (!peerId) {
        set.status = 404;
        return { error: "Conversation not found" };
      }
      dmFanOut.publish(peerId, {
        kind: "dm.typing",
        conversationId: params.id,
        userId,
        isTyping: body.isTyping,
        at: new Date().toISOString(),
      });
      return { success: true };
    },
    {
      requireUser: true,
      params: t.Object({ id: t.String() }),
      body: t.Object({ isTyping: t.Boolean() }),
      detail: {
        summary: "Typing indicator",
        description:
          "Broadcasts an ephemeral typing indicator to the peer. Not persisted.",
        tags: ["Direct Messages", "Realtime"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .post(
    "/blocks",
    async ({ userId, body }) => {
      const state = await dmService.setBlock(userId, body.peerId, body.blocked);
      dmFanOut.publish(body.peerId, {
        kind: "dm.block",
        peerId: userId,
        blocked: body.blocked,
      });
      return state;
    },
    {
      requireUser: true,
      body: dmBlockPeerBodySchema,
      detail: {
        summary: "Block or unblock a peer",
        description:
          "Blocks or unblocks DM from a peer for the authenticated user.",
        tags: ["Direct Messages"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .get(
    "/blocks/:peerId",
    async ({ userId, params }) => {
      return dmService.getBlockState(userId, params.peerId);
    },
    {
      requireUser: true,
      params: t.Object({ peerId: t.String() }),
      detail: {
        summary: "Get block state",
        description: "Returns the mutual block state with a peer.",
        tags: ["Direct Messages"],
        security: [{ bearerAuth: [] }],
      },
    },
  )
  .ws("/", {
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
      // 仅接收 — 忽略客户端消息
    },
    close(ws) {
      const userId = (ws.data as any).userId;
      if (userId) {
        dmFanOut.unsubscribe(userId, ws);
      }
    },
  });
