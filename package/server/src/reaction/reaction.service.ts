import { NotificationType, type ReactionListQuery } from "@rezics/contract";
import type { Prisma, Reaction, ReactionSummary } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { emitNotificationEvent } from "../notify/notify-client";

/**
 * Reaction Service - CRUD + summary counters
 * Maintains both per-user Reaction rows and aggregate ReactionSummary counters.
 */
export class ReactionService {
  private whereFromQuery(query: ReactionListQuery): Prisma.ReactionWhereInput {
    const and: Prisma.ReactionWhereInput[] = [];
    if (query.targetId) and.push({ targetId: query.targetId });
    if (query.reaction) and.push({ reaction: query.reaction });
    if (query.userId) and.push({ userId: query.userId });
    return and.length ? { AND: and } : {};
  }

  async list(query: ReactionListQuery = {}): Promise<{
    reactions: Reaction[];
    total: number;
  }> {
    const limit = Math.max(1, Math.min(Number(query.limit ?? 20), 100));
    const start = Math.max(0, Number(query.start ?? 0));
    const where = this.whereFromQuery(query);
    const [rows, total] = await Promise.all([
      prisma.reaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: start,
        take: limit,
      }),
      prisma.reaction.count({ where }),
    ]);
    return { reactions: rows, total };
  }
  /**
   * Get aggregated reaction counts.
   *
   * - Single-target mode (backward compatible):
   *   getSummary(targetId) -> Record<reaction, count>
   * - Multi-target mode:
   *   getSummary([id1, id2]) -> Record<targetId, Record<reaction, count>>
   */
  async getSummary(targetId: string): Promise<Record<string, number>>;
  async getSummary(targetIds: string[]): Promise<ReactionSummary[]>;
  async getSummary(
    target: string | string[],
  ): Promise<ReactionSummary[] | Record<string, number>> {
    // Multi-target aggregated mode
    if (Array.isArray(target)) {
      if (!target.length) return {};

      const rows = await prisma.reactionSummary.findMany({
        where: { targetId: { in: target } },
      });

      const byTarget: Record<string, Record<string, number>> = {};
      // Ensure all requested ids exist in the result map
      for (const id of target) {
        byTarget[id] = {};
      }
      return rows;
    }

    // Single-target mode (backward compatible)
    const rows = await prisma.reactionSummary.findMany({
      where: { targetId: target },
    });
    const result: Record<string, number> = {};
    for (const r of rows) result[r.reaction] = r.count;
    return result;
  }

  /**
   * Get current user's reactions.
   *
   * - Single targetId: returns string[] (reactions for that target)
   * - Multiple targetIds: returns Record<targetId, string[]>
   */
  async getUserReactions(userId: string, targetId: string): Promise<string[]>;
  async getUserReactions(
    userId: string,
    targetIds: string[],
  ): Promise<Record<string, string[]>>;
  async getUserReactions(
    userId: string,
    target: string | string[],
  ): Promise<string[] | Record<string, string[]>> {
    // Multi-target aggregated mode
    if (Array.isArray(target)) {
      if (!target.length) return {};

      const rows = await prisma.reaction.findMany({
        where: {
          userId,
          targetId: { in: target },
        },
        select: {
          targetId: true,
          reaction: true,
        },
      });

      const result: Record<string, string[]> = {};
      // Ensure all requested ids exist in the map
      for (const id of target) {
        result[id] = [];
      }
      for (const row of rows) {
        result[row.targetId]?.push(row.reaction);
      }
      return result;
    }

    // Single-target mode (backward compatible)
    const rows = await prisma.reaction.findMany({
      where: { userId, targetId: target },
      select: { reaction: true },
    });
    return rows.map((r) => r.reaction);
  }

  /** Create a reaction (idempotent). Increments summary only if newly created. */
  async create(
    params: Pick<Reaction, "userId" | "targetId" | "reaction">,
  ): Promise<Reaction> {
    const { userId, targetId, reaction } = params;
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findUnique({
        where: {
          userId_targetId_reaction: {
            userId,
            targetId,
            reaction,
          },
        },
      });
      if (existing) return existing;

      const created = await tx.reaction.create({
        data: { userId, targetId, reaction },
      });

      await tx.reactionSummary.upsert({
        where: { targetId_reaction: { targetId, reaction } },
        create: { targetId, reaction, count: 1 },
        update: { count: { increment: 1 } },
      });

      // If this is a bookmark reaction, ensure a Bookmark row exists (without tags for now).
      if (reaction === "bookmark") {
        await tx.bookmark.upsert({
          where: {
            userId_targetId: {
              userId,
              targetId,
            },
          },
          create: {
            userId,
            targetId,
          },
          update: {},
        });
      }

      return created;
    });

    // Emit notification (fire-and-forget)
    const notifType =
      reaction === "bookmark"
        ? NotificationType.FAVORITE
        : NotificationType.LIKE;
    prisma.unit
      .findUnique({ where: { id: targetId }, select: { userId: true, title: true } })
      .then((unit) => {
        if (unit && unit.userId !== userId) {
          emitNotificationEvent({
            recipientId: unit.userId,
            type: notifType,
            actorId: userId,
            entityType: "unit",
            entityId: targetId,
            meta: { entityTitle: unit.title ?? undefined },
          }).catch(() => {});
        }
      })
      .catch(() => {});

    return result;
  }

  /** Delete a reaction for a user (idempotent). Decrements summary if deleted. */
  async remove(
    params: Pick<Reaction, "userId" | "targetId" | "reaction">,
  ): Promise<{ deleted: boolean }> {
    const { userId, targetId, reaction } = params;
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findUnique({
        where: {
          userId_targetId_reaction: {
            userId,
            targetId,
            reaction,
          },
        },
        select: { id: true },
      });
      if (!existing) return { deleted: false };

      await tx.reaction.delete({
        where: {
          userId_targetId_reaction: {
            userId,
            targetId,
            reaction,
          },
        },
      });

      // Decrement counter; if row missing, upsert to 0 then decrement would fail, so guard with updateMany
      await tx.reactionSummary
        .update({
          where: {
            targetId_reaction: { targetId, reaction },
          },
          data: { count: { decrement: 1 } },
        })
        .catch(() => Promise.resolve());

      // If we removed a bookmark reaction, also remove the Bookmark row (tags no longer apply).
      if (reaction === "bookmark") {
        await tx.bookmark.deleteMany({
          where: {
            userId,
            targetId,
          },
        });
      }

      return { deleted: true };
    });
  }

  /** Update reaction type (old -> next). Handles summaries accordingly. */
  async update(
    userId: string,
    targetId: string,
    oldReaction: string,
    newReaction: string,
  ): Promise<{ reaction: Reaction | null; changed: boolean }> {
    if (oldReaction === newReaction) {
      const existing = await prisma.reaction.findUnique({
        where: {
          userId_targetId_reaction: {
            userId,
            targetId,
            reaction: newReaction,
          },
        },
      });
      return { reaction: existing ?? null, changed: false };
    }

    return await prisma.$transaction(async (tx) => {
      // Remove old if exists
      const old = await tx.reaction.findUnique({
        where: {
          userId_targetId_reaction: {
            userId,
            targetId,
            reaction: oldReaction,
          },
        },
        select: { id: true },
      });
      if (old) {
        await tx.reaction.delete({
          where: {
            userId_targetId_reaction: {
              userId,
              targetId,
              reaction: oldReaction,
            },
          },
        });
        await tx.reactionSummary
          .update({
            where: {
              targetId_reaction: {
                targetId,
                reaction: oldReaction,
              },
            },
            data: { count: { decrement: 1 } },
          })
          .catch(() => Promise.resolve());
        // If old reaction was bookmark, drop bookmark row.
        if (oldReaction === "bookmark") {
          await tx.bookmark.deleteMany({
            where: {
              userId,
              targetId,
            },
          });
        }
      }

      // Ensure new exists; only increment summary if this is newly created
      const newExists = await tx.reaction.findUnique({
        where: {
          userId_targetId_reaction: {
            userId,
            targetId,
            reaction: newReaction,
          },
        },
      });

      let result: Reaction;
      if (newExists) {
        result = newExists;
      } else {
        result = await tx.reaction.create({
          data: { userId, targetId, reaction: newReaction },
        });
        await tx.reactionSummary.upsert({
          where: {
            targetId_reaction: {
              targetId,
              reaction: newReaction,
            },
          },
          create: { targetId, reaction: newReaction, count: 1 },
          update: { count: { increment: 1 } },
        });
        // If new reaction is bookmark, ensure a Bookmark row exists.
        if (newReaction === "bookmark") {
          await tx.bookmark.upsert({
            where: {
              userId_targetId: {
                userId,
                targetId,
              },
            },
            create: {
              userId,
              targetId,
            },
            update: {},
          });
        }
      }

      return { reaction: result, changed: true };
    });
  }
}

export const reactionService = new ReactionService();
