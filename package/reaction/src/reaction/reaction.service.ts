import type { Reaction } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { allowedReactionTypes } from "../env";

export class ReactionService {
  /** Get aggregated reaction counts for one or more targets. */
  async getSummary(
    targetIds: string[],
  ): Promise<Record<string, Record<string, number>>> {
    if (!targetIds.length) return {};

    const rows = await prisma.reactionSummary.findMany({
      where: { targetId: { in: targetIds } },
    });

    const result: Record<string, Record<string, number>> = {};
    for (const id of targetIds) {
      result[id] = {};
    }
    for (const row of rows) {
      const target = result[row.targetId];
      if (target) target[row.reaction] = row.count;
    }
    return result;
  }

  /** Get current user's reaction types for one or more targets. */
  async getUserReactions(
    userId: string,
    targetIds: string[],
  ): Promise<Record<string, string[]>> {
    if (!targetIds.length) return {};

    const rows = await prisma.reaction.findMany({
      where: { userId, targetId: { in: targetIds } },
      select: { targetId: true, reaction: true },
    });

    const result: Record<string, string[]> = {};
    for (const id of targetIds) {
      result[id] = [];
    }
    for (const row of rows) {
      result[row.targetId]?.push(row.reaction);
    }
    return result;
  }

  /**
   * Create a reaction (idempotent).
   * Returns the reaction and whether it was newly created.
   */
  async create(
    userId: string,
    targetId: string,
    reaction: string,
  ): Promise<{ reaction: Reaction; created: boolean }> {
    if (!allowedReactionTypes.has(reaction)) {
      throw new Error(`Invalid reaction type: ${reaction}`);
    }

    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findUnique({
        where: { userId_targetId_reaction: { userId, targetId, reaction } },
      });
      if (existing) return { reaction: existing, created: false };

      const created = await tx.reaction.create({
        data: { userId, targetId, reaction },
      });

      await tx.reactionSummary.upsert({
        where: { targetId_reaction: { targetId, reaction } },
        create: { targetId, reaction, count: 1 },
        update: { count: { increment: 1 } },
      });

      return { reaction: created, created: true };
    });

    return result;
  }

  /** Delete a reaction (idempotent). Decrements summary if deleted. */
  async remove(
    userId: string,
    targetId: string,
    reaction: string,
  ): Promise<{ deleted: boolean }> {
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findUnique({
        where: { userId_targetId_reaction: { userId, targetId, reaction } },
        select: { id: true },
      });
      if (!existing) return { deleted: false };

      await tx.reaction.delete({
        where: { userId_targetId_reaction: { userId, targetId, reaction } },
      });

      await tx.reactionSummary
        .update({
          where: { targetId_reaction: { targetId, reaction } },
          data: { count: { decrement: 1 } },
        })
        .catch(() => {});

      return { deleted: true };
    });
  }
}

export const reactionService = new ReactionService();
