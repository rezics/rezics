import { dmSendBodySchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import { authMacro } from "../middleware";
import { sendDm } from "./notify-client";

export const dmServerApi = new Elysia({ prefix: "/dm" }).use(authMacro).post(
  "/send",
  async ({ body, identity, set }) => {
    const senderId = identity.userId;
    const { recipientId, content } = body;

    if (senderId === recipientId) {
      set.status = 400;
      return { error: "Cannot send a message to yourself" };
    }

    // Check mutual follow or at least sender follows recipient
    const follow = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: senderId,
          followingId: recipientId,
        },
      },
    });

    if (!follow) {
      set.status = 403;
      return {
        error: "You must follow the recipient to send a direct message",
      };
    }

    const result = await sendDm({ senderId, recipientId, content });
    if (!result.ok) {
      set.status = 502;
      return { error: "Failed to deliver message" };
    }

    return { success: true, ...(result.data as object) };
  },
  {
    requireLogin: true,
    body: dmSendBodySchema,
    detail: {
      summary: "Send direct message",
      description:
        "Sends a direct message to another user. Requires the sender to follow the recipient.",
      tags: ["Direct Messages"],
    },
  },
);
