import type { SubscriptionDTO } from "@rezics/contract";
import {
  assertValidChannels,
  InvalidChannelError,
  isSubscribableUnitType,
  type SubscribableUnitType,
} from "@rezics/contract";
import { and, desc, eq, sql } from "drizzle-orm";
import { Realm, RealmMember, Subscription, Unit, User } from "../db/schema";
import { broadcast } from "../notify-boundary/notify-boundary.client";
import { AppError } from "../utils/errors";
import {
  activateSubscriptionListEntryInTx,
  markSubscriptionListEntryRemovedInTx,
} from "./subscription-list-entry.service";
import { mapSubscriptionToDTO } from "./subscription.mapper";

const DEFAULT_CHANNELS = ["*"] as const;

type SubscriptionRow = typeof Subscription.$inferSelect;
type TargetUnit = Pick<typeof Unit.$inferSelect, "id" | "type" | "userId">;
type BroadcastFollow = typeof broadcast;

export type SubscriptionRepository = {
  getTargetUnit(unitId: string): Promise<TargetUnit | undefined>;
  getRealm(unitId: string): Promise<{ isPublic: boolean } | undefined>;
  isRealmMember(realmUnitId: string, userId: string): Promise<boolean>;
  createWithCounters(input: {
    subscriberUnitId: string;
    subscribedUnitId: string;
    subscribedType: SubscribableUnitType;
    channels: string[];
    isUserToUser: boolean;
  }): Promise<SubscriptionRow>;
  findSubscriptionId(
    subscriberUnitId: string,
    subscribedUnitId: string,
  ): Promise<string | undefined>;
  deleteWithCounters(input: {
    id: string;
    subscriberUnitId: string;
    subscribedUnitId: string;
    isUserToUser: boolean;
  }): Promise<void>;
  updateChannels(input: {
    subscriberUnitId: string;
    subscribedUnitId: string;
    channels: string[];
  }): Promise<SubscriptionRow>;
  listMine(
    userId: string,
    opts: { subscribedType?: string },
  ): Promise<SubscriptionRow[]>;
  findChannels(
    subscriberUnitId: string,
    subscribedUnitId: string,
  ): Promise<string[] | undefined>;
  getSubscriberCount(subscribedUnitId: string): Promise<number | undefined>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function createDrizzleSubscriptionRepository(): SubscriptionRepository {
  return {
    async getTargetUnit(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ id: Unit.id, type: Unit.type, userId: Unit.userId })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      return row;
    },

    async getRealm(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ isPublic: Realm.isPublic })
        .from(Realm)
        .where(eq(Realm.unitId, unitId))
        .limit(1);
      return row;
    },

    async isRealmMember(realmUnitId, userId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ realmUnitId: RealmMember.realmUnitId })
        .from(RealmMember)
        .where(
          and(
            eq(RealmMember.realmUnitId, realmUnitId),
            eq(RealmMember.userId, userId),
          ),
        )
        .limit(1);
      return Boolean(row);
    },

    async createWithCounters({
      subscriberUnitId,
      subscribedUnitId,
      subscribedType,
      channels,
      isUserToUser,
    }) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const [created] = await tx
          .insert(Subscription)
          .values({
            subscriberUnitId,
            subscribedUnitId,
            channels,
            updatedAt: new Date(),
          })
          .returning();
        if (!created) {
          throw new AppError(500, "Subscription was not created", {
            code: "subscription_create_failed",
          });
        }
        await tx
          .update(Unit)
          .set({
            subscriberCount: sql`${Unit.subscriberCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(Unit.id, subscribedUnitId));
        await activateSubscriptionListEntryInTx(tx, {
          userUnitId: subscriberUnitId,
          subscribedUnitId,
          subscribedType,
        });
        if (isUserToUser) {
          await tx
            .update(User)
            .set({ followersCount: sql`${User.followersCount} + 1` })
            .where(eq(User.unitId, subscribedUnitId));
          await tx
            .update(User)
            .set({ followingsCount: sql`${User.followingsCount} + 1` })
            .where(eq(User.unitId, subscriberUnitId));
        }
        return created;
      });
    },

    async findSubscriptionId(subscriberUnitId, subscribedUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ id: Subscription.id })
        .from(Subscription)
        .where(
          and(
            eq(Subscription.subscriberUnitId, subscriberUnitId),
            eq(Subscription.subscribedUnitId, subscribedUnitId),
          ),
        )
        .limit(1);
      return row?.id;
    },

    async deleteWithCounters({
      id,
      subscriberUnitId,
      subscribedUnitId,
      isUserToUser,
    }) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        await tx.delete(Subscription).where(eq(Subscription.id, id));
        await tx
          .update(Unit)
          .set({
            subscriberCount: sql`${Unit.subscriberCount} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(Unit.id, subscribedUnitId));
        if (isUserToUser) {
          await tx
            .update(User)
            .set({ followersCount: sql`${User.followersCount} - 1` })
            .where(eq(User.unitId, subscribedUnitId));
          await tx
            .update(User)
            .set({ followingsCount: sql`${User.followingsCount} - 1` })
            .where(eq(User.unitId, subscriberUnitId));
        }
        await markSubscriptionListEntryRemovedInTx(tx, {
          userUnitId: subscriberUnitId,
          subscribedUnitId,
        });
      });
    },

    async updateChannels({ subscriberUnitId, subscribedUnitId, channels }) {
      const db = await getServerDb();
      const [row] = await db
        .update(Subscription)
        .set({ channels, updatedAt: new Date() })
        .where(
          and(
            eq(Subscription.subscriberUnitId, subscriberUnitId),
            eq(Subscription.subscribedUnitId, subscribedUnitId),
          ),
        )
        .returning();
      if (!row) {
        throw new AppError(404, "Subscription not found", {
          code: "subscription_not_found",
        });
      }
      return row;
    },

    async listMine(userId, opts) {
      const db = await getServerDb();
      if (opts.subscribedType) {
        const rows = await db
          .select({ subscription: Subscription })
          .from(Subscription)
          .innerJoin(Unit, eq(Subscription.subscribedUnitId, Unit.id))
          .where(
            and(
              eq(Subscription.subscriberUnitId, userId),
              eq(Unit.type, opts.subscribedType as TargetUnit["type"]),
            ),
          )
          .orderBy(desc(Subscription.createdAt));
        return rows.map((row) => row.subscription);
      }

      return db
        .select()
        .from(Subscription)
        .where(eq(Subscription.subscriberUnitId, userId))
        .orderBy(desc(Subscription.createdAt));
    },

    async findChannels(subscriberUnitId, subscribedUnitId) {
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
      return row?.channels ?? undefined;
    },

    async getSubscriberCount(subscribedUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ subscriberCount: Unit.subscriberCount })
        .from(Unit)
        .where(eq(Unit.id, subscribedUnitId))
        .limit(1);
      return row?.subscriberCount;
    },
  };
}

/**
 * Service for `Subscription` rows — the generic attention edge from a
 * subscriber Unit (USER in v1) to any subscribed Unit. All write paths
 * maintain the denormalized counters on `Unit.subscriberCount` and on
 * `User.followersCount` / `followingsCount` (USER->USER edges) atomically.
 * `Subscription` 行的服务——从订阅者 Unit（v1 中为 USER）到任意被订阅
 * Unit 的通用关注边。所有写入路径都原子地维护 `Unit.subscriberCount` 以及
 * `User.followersCount` / `followingsCount`（USER->USER 边）上的反范式计数器。
 */
export class SubscriptionService {
  constructor(
    private readonly repository = createDrizzleSubscriptionRepository(),
    private readonly broadcastFollow: BroadcastFollow = broadcast,
  ) {}

  /**
   * Insert a subscription row plus counter updates in one transaction.
   * 在单个事务中插入订阅行并更新计数器。
   *
   * - `subscriberUnitId === subscribedUnitId` is rejected (400).
   *   `subscriberUnitId === subscribedUnitId` 会被拒绝（400）。
   * - Target's `Unit.type` must be in `CHANNEL_REGISTRY` (400 otherwise).
   *   目标的 `Unit.type` 必须存在于 `CHANNEL_REGISTRY` 中（否则 400）。
   * - Private REALM targets require the subscriber to already be a
   *   `RealmMember`; non-members can only subscribe to public realms
   *   (403 otherwise).
   *   私有 REALM 目标要求订阅者已是 `RealmMember`；非成员只能订阅公开
   *   realm（否则 403）。
   * - Channels are validated against the per-type registry. Default is
   *   `['*']` when omitted; an empty array is rejected (would be a
   *   silent no-op subscription).
   *   channels 会针对按类型的注册表进行校验。省略时默认为 `['*']`；空数组
   *   会被拒绝（否则会成为静默无效的订阅）。
   * - Database uniqueness on `(subscriberUnitId, subscribedUnitId)` rejects
   *   duplicates.
   *   `(subscriberUnitId, subscribedUnitId)` 上的数据库唯一性约束会拒绝重复项。
   */
  async subscribe(
    subscriberUnitId: string,
    subscribedUnitId: string,
    channels?: readonly string[],
  ): Promise<SubscriptionDTO> {
    if (subscriberUnitId === subscribedUnitId) {
      throw new AppError(400, "Cannot subscribe to your own Unit");
    }

    const target = await this.repository.getTargetUnit(subscribedUnitId);
    if (!target) {
      throw new AppError(404, "subscribed Unit not found");
    }

    if (!isSubscribableUnitType(target.type)) {
      throw new AppError(
        400,
        `Unit type ${target.type} is not subscribable. See CHANNEL_REGISTRY in @rezics/contract.`,
      );
    }
    const subscribedType: SubscribableUnitType = target.type;

    const effectiveChannels =
      channels && channels.length > 0 ? [...channels] : [...DEFAULT_CHANNELS];

    try {
      assertValidChannels(subscribedType, effectiveChannels);
    } catch (err) {
      if (err instanceof InvalidChannelError) {
        throw new AppError(400, err.message);
      }
      throw err;
    }

    if (subscribedType === "REALM") {
      const realm = await this.repository.getRealm(subscribedUnitId);
      if (!realm) {
        throw new AppError(404, "Target Realm not found");
      }
      if (
        !realm.isPublic &&
        !(await this.repository.isRealmMember(
          subscribedUnitId,
          subscriberUnitId,
        ))
      ) {
        throw new AppError(
          403,
          "Cannot subscribe to a private realm without membership",
        );
      }
    }

    const isUserToUser = subscribedType === "USER";

    const row = await this.repository.createWithCounters({
      subscriberUnitId,
      subscribedUnitId,
      subscribedType,
      channels: effectiveChannels,
      isUserToUser,
    });

    // A failed notification must not roll back the subscription write.
    // 通知失败不得回滚订阅写入。
    if (isUserToUser) {
      this.broadcastFollow({
        kind: "follow.new",
        sourceUnitId: subscribedUnitId,
        directRecipients: [subscribedUnitId],
        actorId: subscriberUnitId,
      }).catch(() => {});
    }

    return mapSubscriptionToDTO(row);
  }

  /**
   * Delete the subscription row and reverse the counter updates in one
   * transaction. Missing rows are idempotent — returns `false` rather
   * than throwing so the UI can be a single-button toggle.
   * 在单个事务中删除订阅行并反向更新计数器。缺失的行是幂等的——返回
   * `false` 而非抛出异常，以便 UI 可以是单按钮切换。
   */
  async unsubscribe(
    subscriberUnitId: string,
    subscribedUnitId: string,
  ): Promise<boolean> {
    const existingId = await this.repository.findSubscriptionId(
      subscriberUnitId,
      subscribedUnitId,
    );
    if (!existingId) return false;

    const target = await this.repository.getTargetUnit(subscribedUnitId);
    const isUserToUser = target?.type === "USER";

    await this.repository.deleteWithCounters({
      id: existingId,
      subscriberUnitId,
      subscribedUnitId,
      isUserToUser,
    });
    return true;
  }

  /**
   * Replace `channels` on an existing subscription row. Channels are
   * validated against the subscribed unit's UnitType registry. Counter values
   * are not touched (channel scope changes do not affect the count).
   * 替换现有订阅行上的 `channels`。channels 会针对被订阅 unit 的 UnitType
   * 注册表进行校验。计数器值不会被改动（channel 范围变更不影响计数）。
   */
  async updateChannels(
    subscriberUnitId: string,
    subscribedUnitId: string,
    channels: readonly string[],
  ): Promise<SubscriptionDTO> {
    if (channels.length === 0) {
      throw new AppError(
        400,
        "Channels cannot be empty; use DELETE /subscription/:subscribedUnitId to unsubscribe",
      );
    }

    const target = await this.repository.getTargetUnit(subscribedUnitId);
    if (!target) {
      throw new AppError(404, "subscribed Unit not found");
    }
    if (!isSubscribableUnitType(target.type)) {
      throw new AppError(400, `Unit type ${target.type} is not subscribable`);
    }

    try {
      assertValidChannels(target.type, channels);
    } catch (err) {
      if (err instanceof InvalidChannelError) {
        throw new AppError(400, err.message);
      }
      throw err;
    }

    const row = await this.repository.updateChannels({
      subscriberUnitId,
      subscribedUnitId,
      channels: [...channels],
    });
    return mapSubscriptionToDTO(row);
  }

  /**
   * List the caller's subscriptions, optionally filtered by the
   * subscribed unit's UnitType (e.g., `subscribedType=USER` powers the
   * "followings" view on the profile-followers-tab).
   * 列出调用方的订阅，可选按被订阅 unit 的 UnitType 过滤（例如
   * `subscribedType=USER` 支撑 profile-followers-tab 上的“关注中”视图）。
   */
  async listMine(
    userId: string,
    opts: { subscribedType?: string } = {},
  ): Promise<SubscriptionDTO[]> {
    const rows = await this.repository.listMine(userId, opts);
    return rows.map(mapSubscriptionToDTO);
  }

  /**
   * Probe whether the caller is subscribed to `subscribedUnitId`. Returns
   * `{ subscribed: false }` rather than 404 so the UI can render a
   * toggle without two requests.
   * 探测调用方是否已订阅 `subscribedUnitId`。返回 `{ subscribed: false }`
   * 而非 404，以便 UI 无需两次请求即可渲染切换。
   */
  async checkSubscription(
    userId: string,
    subscribedUnitId: string,
  ): Promise<{ subscribed: boolean; channels?: string[] }> {
    const channels = await this.repository.findChannels(
      userId,
      subscribedUnitId,
    );
    if (!channels) return { subscribed: false };
    return { subscribed: true, channels };
  }

  /**
   * Read the cached subscriber count from `Unit.subscriberCount`. The
   * counter is maintained transactionally by this service alongside
   * every Subscription insert/delete; the migration seeded the initial
   * value from a COUNT(*) over the backfilled rows.
   * 从 `Unit.subscriberCount` 读取缓存的订阅者计数。该计数器由本服务在每次
   * Subscription 插入/删除时事务性地维护；迁移通过对回填行执行 COUNT(*)
   * 来初始化其初始值。
   */
  async getSubscriberCount(subscribedUnitId: string): Promise<number> {
    const subscriberCount =
      await this.repository.getSubscriberCount(subscribedUnitId);
    if (subscriberCount === undefined) {
      throw new AppError(404, "subscribed Unit not found");
    }
    return subscriberCount;
  }
}

export const subscriptionService = new SubscriptionService();
