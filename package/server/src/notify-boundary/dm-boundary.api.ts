import { dmSendBodySchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro } from "@/middleware";
import { deliverDm } from "./dm-boundary.sender";
import { subscriptionPermitsDm } from "./dm-boundary.subscription";

/**
 * Whether a user-to-user block exists between the two users in either
 * direction. Mirrors `blockService.isBlockedEitherWay`; inlined here against
 * the already-imported `prisma` so the DM route does not depend on the block
 * domain module.
 */
async function isBlockedEitherWay(a: string, b: string): Promise<boolean> {
  const row = await prisma.userBlock.findFirst({
    where: {
      OR: [
        { blockerId: a, blockedId: b },
        { blockerId: b, blockedId: a },
      ],
    },
    select: { id: true },
  });
  return row !== null;
}

export const dmBoundaryApi = new Elysia({ prefix: "/dm" }).use(authMacro).post(
  "/send",
  async ({ body, identity, set }) => {
    const senderId = identity.userId;
    const { recipientId, content } = body;

    if (senderId === recipientId) {
      set.status = 400;
      return { error: "Cannot send a message to yourself" };
    }

    // User-to-user block gate: neither party may DM the other if either has
    // blocked the other. Checked before the subscription/policy gates so a
    // block always wins.
    if (await isBlockedEitherWay(senderId, recipientId)) {
      set.status = 403;
      return { error: "You cannot message this user" };
    }

    const decision = await governanceRoutePolicyService.decideForIdentity({
      identity,
      action: realmPolicyActions.dmSend,
      target: { kind: "direct-message", id: recipientId },
    });
    if (!decision.allowed) {
      set.status = 403;
      return {
        error: decision.safeMessage ?? "Forbidden: policy denied this action",
      };
    }

    // Permission gate: sender must have a Subscription(sender -> recipient)
    // whose `channels` permits DM. Existing follow-based DM relationships
    // were materialized as Subscription rows with channels=['*'].
    const sub = await prisma.subscription.findUnique({
      where: {
        subscriberUnitId_subscribedUnitId: {
          subscriberUnitId: senderId,
          subscribedUnitId: recipientId,
        },
      },
      select: { channels: true },
    });

    if (!sub || !subscriptionPermitsDm(sub.channels)) {
      set.status = 403;
      return {
        error:
          "You must subscribe to the recipient with DM enabled to send a direct message",
      };
    }

    const result = await deliverDm({ senderId, recipientId, content });
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
        "Sends a direct message to another user. Requires the sender to have an active Subscription to the recipient with channels permitting DM ('*', 'dm.*', or 'dm.message').",
      tags: ["Direct Messages"],
    },
  },
);
