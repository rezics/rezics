import { dmSendBodySchema } from "@rezics/contract";
import { and, eq, or } from "drizzle-orm";
import { Elysia } from "elysia";
import { governanceRoutePolicyService, realmPolicyActions } from "@/governance";
import { authMacro } from "@/middleware";
import { Subscription, UserBlock } from "../db/schema";
import { deliverDm } from "./dm-boundary.sender";
import { subscriptionPermitsDm } from "./dm-boundary.subscription";

type DmBoundaryDeps = {
  isBlockedEitherWay?: (a: string, b: string) => Promise<boolean>;
  getSubscriptionChannels?: (
    subscriberUnitId: string,
    subscribedUnitId: string,
  ) => Promise<string[] | null | undefined>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

/**
 * Whether a user-to-user block exists between the two users in either
 * direction. Mirrors `blockService.isBlockedEitherWay` while keeping the DM
 * route independent from the block domain module.
 *
 * 两个用户之间是否在任一方向上存在用户对用户的拉黑。镜像
 * `blockService.isBlockedEitherWay`，同时让 DM 路由独立于 block 域模块。
 */
async function defaultIsBlockedEitherWay(
  a: string,
  b: string,
): Promise<boolean> {
  const db = await getServerDb();
  const [row] = await db
    .select({ id: UserBlock.id })
    .from(UserBlock)
    .where(
      or(
        and(eq(UserBlock.blockerId, a), eq(UserBlock.blockedId, b)),
        and(eq(UserBlock.blockerId, b), eq(UserBlock.blockedId, a)),
      ),
    )
    .limit(1);
  return Boolean(row);
}

async function defaultGetSubscriptionChannels(
  subscriberUnitId: string,
  subscribedUnitId: string,
): Promise<string[] | null | undefined> {
  const db = await getServerDb();
  const [row] = await db
    .select({ channels: Subscription.channels })
    .from(Subscription)
    .where(
      and(
        eq(Subscription.subscriberUnitId, subscriberUnitId),
        eq(Subscription.subscribedUnitId, subscribedUnitId),
      ),
    )
    .limit(1);
  return row?.channels;
}

export function createDmBoundaryApi(deps: DmBoundaryDeps = {}) {
  const isBlockedEitherWay =
    deps.isBlockedEitherWay ?? defaultIsBlockedEitherWay;
  const getSubscriptionChannels =
    deps.getSubscriptionChannels ?? defaultGetSubscriptionChannels;

  return new Elysia({ prefix: "/dm" }).use(authMacro).post(
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
      // 用户对用户的拉黑闸门：若任一方拉黑了对方，则双方都不能给对方发 DM。在
      // subscription/policy 闸门之前检查，使拉黑始终优先生效。
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
      // 权限闸门：发送方必须拥有一条 `channels` 允许 DM 的
      // Subscription（sender -> recipient）。既有基于 follow 的 DM 关系已物化为
      // channels=['*'] 的 Subscription 行。
      const channels = await getSubscriptionChannels(senderId, recipientId);

      if (!channels || !subscriptionPermitsDm(channels)) {
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
}

export const dmBoundaryApi = createDmBoundaryApi();
