import type { SubscriptionDTO } from "@rezics/contract";
import {
  assertValidChannels,
  InvalidChannelError,
  isSubscribableUnitType,
  type SubscribableUnitType,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { broadcast } from "../notify-boundary/notify-boundary.client";
import { AppError } from "../utils/errors";
import { mapSubscriptionToDTO } from "./subscription.mapper";

const DEFAULT_CHANNELS = ["*"] as const;

/**
 * Service for `Subscription` rows — the generic attention edge from a
 * subscriber Unit (USER in v1) to any target Unit. All write paths
 * maintain the denormalized counters on `Unit.subscriberCount` and on
 * `User.followersCount` / `followingsCount` (USER→USER edges) atomically.
 */
export class SubscriptionService {
  /**
   * Insert a subscription row plus counter updates in one transaction.
   *
   * - `subscriberUnitId === targetUnitId` is rejected (400).
   * - Target's `Unit.type` must be in `CHANNEL_REGISTRY` (400 otherwise).
   * - Private REALM targets require the subscriber to already be a
   *   `RealmMember`; non-members can only subscribe to public realms
   *   (403 otherwise).
   * - Channels are validated against the per-type registry. Default is
   *   `['*']` when omitted; an empty array is rejected (would be a
   *   silent no-op subscription).
   * - Duplicates surface as Prisma P2002 and map to 409 by the global
   *   onError handler.
   */
  async subscribe(
    subscriberUnitId: string,
    targetUnitId: string,
    channels?: readonly string[],
  ): Promise<SubscriptionDTO> {
    if (subscriberUnitId === targetUnitId) {
      throw new AppError(400, "Cannot subscribe to your own Unit");
    }

    const target = await prisma.unit.findUnique({
      where: { id: targetUnitId },
      select: { id: true, type: true, userId: true },
    });
    if (!target) {
      throw new AppError(404, "Target Unit not found");
    }

    if (!isSubscribableUnitType(target.type)) {
      throw new AppError(
        400,
        `Unit type ${target.type} is not subscribable. See CHANNEL_REGISTRY in @rezics/contract.`,
      );
    }
    const targetType: SubscribableUnitType = target.type;

    const effectiveChannels =
      channels && channels.length > 0 ? [...channels] : [...DEFAULT_CHANNELS];

    try {
      assertValidChannels(targetType, effectiveChannels);
    } catch (err) {
      if (err instanceof InvalidChannelError) {
        throw new AppError(400, err.message);
      }
      throw err;
    }

    if (targetType === "REALM") {
      const realm = await prisma.realm.findUnique({
        where: { unitId: targetUnitId },
        select: { isPublic: true },
      });
      if (!realm) {
        throw new AppError(404, "Target Realm not found");
      }
      if (!realm.isPublic) {
        const member = await prisma.realmMember.findUnique({
          where: {
            realmUnitId_userId: {
              realmUnitId: targetUnitId,
              userId: subscriberUnitId,
            },
          },
          select: { realmUnitId: true },
        });
        if (!member) {
          throw new AppError(
            403,
            "Cannot subscribe to a private realm without membership",
          );
        }
      }
    }

    const isUserToUser = targetType === "USER";

    const row = await prisma.$transaction(async (tx) => {
      const created = await tx.subscription.create({
        data: {
          subscriberUnitId,
          targetUnitId,
          channels: effectiveChannels,
        },
      });
      await tx.unit.update({
        where: { id: targetUnitId },
        data: { subscriberCount: { increment: 1 } },
      });
      if (isUserToUser) {
        await tx.user.update({
          where: { unitId: targetUnitId },
          data: { followersCount: { increment: 1 } },
        });
        await tx.user.update({
          where: { unitId: subscriberUnitId },
          data: { followingsCount: { increment: 1 } },
        });
      }
      return created;
    });

    // For USER→USER subscriptions, emit the `follow.new` notification
    // event so the target user is alerted. Preserves the prior Follow
    // behaviour now that Follow is retired. Fire-and-forget — a failed
    // notification must not roll back the subscription write.
    if (isUserToUser) {
      broadcast({
        kind: "follow.new",
        sourceUnitId: targetUnitId,
        directRecipients: [targetUnitId],
        actorId: subscriberUnitId,
      }).catch(() => {});
    }

    return mapSubscriptionToDTO(row);
  }

  /**
   * Delete the subscription row and reverse the counter updates in one
   * transaction. Missing rows are idempotent — returns `false` rather
   * than throwing so the UI can be a single-button toggle.
   */
  async unsubscribe(
    subscriberUnitId: string,
    targetUnitId: string,
  ): Promise<boolean> {
    const existing = await prisma.subscription.findUnique({
      where: {
        subscriberUnitId_targetUnitId: { subscriberUnitId, targetUnitId },
      },
      select: { id: true },
    });
    if (!existing) return false;

    const target = await prisma.unit.findUnique({
      where: { id: targetUnitId },
      select: { type: true },
    });
    const isUserToUser = target?.type === "USER";

    await prisma.$transaction(async (tx) => {
      await tx.subscription.delete({ where: { id: existing.id } });
      await tx.unit.update({
        where: { id: targetUnitId },
        data: { subscriberCount: { decrement: 1 } },
      });
      if (isUserToUser) {
        await tx.user.update({
          where: { unitId: targetUnitId },
          data: { followersCount: { decrement: 1 } },
        });
        await tx.user.update({
          where: { unitId: subscriberUnitId },
          data: { followingsCount: { decrement: 1 } },
        });
      }
    });
    return true;
  }

  /**
   * Replace `channels` on an existing subscription row. Channels are
   * validated against the target's UnitType registry. Counter values
   * are not touched (channel scope changes do not affect the count).
   */
  async updateChannels(
    subscriberUnitId: string,
    targetUnitId: string,
    channels: readonly string[],
  ): Promise<SubscriptionDTO> {
    if (channels.length === 0) {
      throw new AppError(
        400,
        "Channels cannot be empty; use DELETE /subscription/:targetUnitId to unsubscribe",
      );
    }

    const target = await prisma.unit.findUnique({
      where: { id: targetUnitId },
      select: { type: true },
    });
    if (!target) {
      throw new AppError(404, "Target Unit not found");
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

    const row = await prisma.subscription.update({
      where: {
        subscriberUnitId_targetUnitId: { subscriberUnitId, targetUnitId },
      },
      data: { channels: [...channels] },
    });
    return mapSubscriptionToDTO(row);
  }

  /**
   * List the caller's subscriptions, optionally filtered by the
   * target's UnitType (e.g., `targetType=USER` powers the "followings"
   * view on the profile-followers-tab).
   */
  async listMine(
    userId: string,
    opts: { targetType?: string } = {},
  ): Promise<SubscriptionDTO[]> {
    const rows = await prisma.subscription.findMany({
      where: {
        subscriberUnitId: userId,
        ...(opts.targetType
          ? { target: { type: opts.targetType as never } }
          : {}),
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(mapSubscriptionToDTO);
  }

  /**
   * Probe whether the caller is subscribed to `targetUnitId`. Returns
   * `{ subscribed: false }` rather than 404 so the UI can render a
   * toggle without two requests.
   */
  async checkSubscription(
    userId: string,
    targetUnitId: string,
  ): Promise<{ subscribed: boolean; channels?: string[] }> {
    const row = await prisma.subscription.findUnique({
      where: {
        subscriberUnitId_targetUnitId: {
          subscriberUnitId: userId,
          targetUnitId,
        },
      },
      select: { channels: true },
    });
    if (!row) return { subscribed: false };
    return { subscribed: true, channels: row.channels };
  }

  /**
   * Read the cached subscriber count from `Unit.subscriberCount`. The
   * counter is maintained transactionally by this service alongside
   * every Subscription insert/delete; the migration seeded the initial
   * value from a COUNT(*) over the backfilled rows.
   */
  async getSubscriberCount(targetUnitId: string): Promise<number> {
    const unit = await prisma.unit.findUnique({
      where: { id: targetUnitId },
      select: { subscriberCount: true },
    });
    if (!unit) {
      throw new AppError(404, "Target Unit not found");
    }
    return unit.subscriberCount;
  }
}

export const subscriptionService = new SubscriptionService();
