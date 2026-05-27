import { dmSendBodySchema } from "@rezics/contract";
import { Elysia } from "elysia";
import { prisma } from "#/prisma/client";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro } from "@/middleware";
import { sendDm } from "./notify-boundary.client";

/**
 * Predicate: does the sender's Subscription to the recipient permit DM?
 *
 * Per design D7a of `engagement-subscription`: a Subscription's `channels`
 * permits DM if it contains the global wildcard `'*'`, the DM category
 * wildcard `'dm.*'`, or the exact event `'dm.message'`. This collapses
 * "I follow you" and "I'll let you DM me" into one edge with channel
 * filtering — see `CHANNEL_REGISTRY.USER` in `@rezics/contract`.
 *
 * Exported for unit testing alongside the dm-boundary route.
 */
export function subscriptionPermitsDm(channels: readonly string[]): boolean {
  return (
    channels.includes("*") ||
    channels.includes("dm.*") ||
    channels.includes("dm.message")
  );
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
        subscriberUnitId_targetUnitId: {
          subscriberUnitId: senderId,
          targetUnitId: recipientId,
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
        "Sends a direct message to another user. Requires the sender to have an active Subscription to the recipient with channels permitting DM ('*', 'dm.*', or 'dm.message').",
      tags: ["Direct Messages"],
    },
  },
);
