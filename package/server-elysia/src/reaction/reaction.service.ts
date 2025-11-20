import {prisma} from '@/prisma/client';
import type {Prisma, Reaction, ReactionSummary} from '@/prisma/client';
import type {ReactionListQuery} from '@package/contract';

/**
 * Reaction Service - CRUD + summary counters
 * Maintains both per-user Reaction rows and aggregate ReactionSummary counters.
 */
export class ReactionService {
  private whereFromQuery(query: ReactionListQuery): Prisma.ReactionWhereInput {
    const and: Prisma.ReactionWhereInput[] = [];
    if (query.targetId) and.push({targetId: query.targetId});
    if (query.reaction) and.push({reaction: query.reaction});
    if (query.userId) and.push({userId: query.userId});
    return and.length ? {AND: and} : {};
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
        orderBy: {createdAt: 'desc'},
        skip: start,
        take: limit,
      }),
      prisma.reaction.count({where}),
    ]);
    return {reactions: rows, total};
  }

  async getSummary(targetId: string): Promise<Record<string, number>> {
    const rows = await prisma.reactionSummary.findMany({
      where: {targetId},
    });
    const result: Record<string, number> = {};
    for (const r of rows) result[r.reaction] = r.count;
    return result;
  }

  async getUserReactions(
    userId: string,
    targetType: string,
    targetId: string,
  ): Promise<string[]> {
    const rows = await prisma.reaction.findMany({
      where: {userId, targetType, targetId},
      select: {reaction: true},
    });
    return rows.map(r => r.reaction);
  }

  /** Create a reaction (idempotent). Increments summary only if newly created. */
  async create(
    params: Pick<Reaction, 'userId' | 'targetType' | 'targetId' | 'reaction'>,
  ): Promise<Reaction> {
    const {userId, targetType, targetId, reaction} = params;
    return await prisma.$transaction(async tx => {
      const existing = await tx.reaction.findUnique({
        where: {
          userId_targetType_targetId_reaction: {
            userId,
            targetType,
            targetId,
            reaction,
          },
        },
      });
      if (existing) return existing;

      const created = await tx.reaction.create({
        data: {userId, targetType, targetId, reaction},
      });

      await tx.reactionSummary.upsert({
        where: {targetType_targetId_reaction: {targetType, targetId, reaction}},
        create: {targetType, targetId, reaction, count: 1},
        update: {count: {increment: 1}},
      });

      return created;
    });
  }

  /** Delete a reaction for a user (idempotent). Decrements summary if deleted. */
  async remove(
    params: Pick<Reaction, 'userId' | 'targetType' | 'targetId' | 'reaction'>,
  ): Promise<{deleted: boolean}> {
    const {userId, targetType, targetId, reaction} = params;
    return await prisma.$transaction(async tx => {
      const existing = await tx.reaction.findUnique({
        where: {
          userId_targetType_targetId_reaction: {
            userId,
            targetType,
            targetId,
            reaction,
          },
        },
        select: {id: true},
      });
      if (!existing) return {deleted: false};

      await tx.reaction.delete({
        where: {
          userId_targetType_targetId_reaction: {
            userId,
            targetType,
            targetId,
            reaction,
          },
        },
      });

      // Decrement counter; if row missing, upsert to 0 then decrement would fail, so guard with updateMany
      await tx.reactionSummary
        .update({
          where: {
            targetType_targetId_reaction: {targetType, targetId, reaction},
          },
          data: {count: {decrement: 1}},
        })
        .catch(() => Promise.resolve());

      return {deleted: true};
    });
  }

  /** Update reaction type (old -> next). Handles summaries accordingly. */
  async update(
    userId: string,
    targetType: string,
    targetId: string,
    oldReaction: string,
    newReaction: string,
  ): Promise<{reaction: Reaction | null; changed: boolean}> {
    if (oldReaction === newReaction) {
      const existing = await prisma.reaction.findUnique({
        where: {
          userId_targetType_targetId_reaction: {
            userId,
            targetType,
            targetId,
            reaction: newReaction,
          },
        },
      });
      return {reaction: existing ?? null, changed: false};
    }

    return await prisma.$transaction(async tx => {
      // Remove old if exists
      const old = await tx.reaction.findUnique({
        where: {
          userId_targetType_targetId_reaction: {
            userId,
            targetType,
            targetId,
            reaction: oldReaction,
          },
        },
        select: {id: true},
      });
      if (old) {
        await tx.reaction.delete({
          where: {
            userId_targetType_targetId_reaction: {
              userId,
              targetType,
              targetId,
              reaction: oldReaction,
            },
          },
        });
        await tx.reactionSummary
          .update({
            where: {
              targetType_targetId_reaction: {
                targetType,
                targetId,
                reaction: oldReaction,
              },
            },
            data: {count: {decrement: 1}},
          })
          .catch(() => Promise.resolve());
      }

      // Ensure new exists; only increment summary if this is newly created
      const newExists = await tx.reaction.findUnique({
        where: {
          userId_targetType_targetId_reaction: {
            userId,
            targetType,
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
          data: {userId, targetType, targetId, reaction: newReaction},
        });
        await tx.reactionSummary.upsert({
          where: {
            targetType_targetId_reaction: {
              targetType,
              targetId,
              reaction: newReaction,
            },
          },
          create: {targetType, targetId, reaction: newReaction, count: 1},
          update: {count: {increment: 1}},
        });
      }

      return {reaction: result, changed: true};
    });
  }
}

export const reactionService = new ReactionService();
