import type { Prisma, Reaction } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { allowedReactionTypes } from "../env";
import {
  CursorDecodeError,
  decodeCursor,
  encodeCursor,
  type ReactionCursor,
} from "./cursor";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const MAX_TARGET_IDS = 1000;

export class TargetIdsOverflowError extends Error {
  readonly statusCode = 400;
  constructor() {
    super(`targetIds exceeds maximum of ${MAX_TARGET_IDS} entries per request`);
    this.name = "TargetIdsOverflowError";
  }
}

export class MalformedCursorError extends Error {
  readonly statusCode = 400;
  constructor() {
    super("Malformed cursor");
    this.name = "MalformedCursorError";
  }
}

function clampLimit(limit: number | undefined): number {
  if (limit === undefined || Number.isNaN(limit)) return DEFAULT_LIMIT;
  const floored = Math.floor(limit);
  if (floored < 1) return 1;
  if (floored > MAX_LIMIT) return MAX_LIMIT;
  return floored;
}

function decodeOptionalCursor(raw: string | undefined): ReactionCursor | null {
  if (!raw) return null;
  try {
    return decodeCursor(raw);
  } catch (e) {
    if (e instanceof CursorDecodeError) throw new MalformedCursorError();
    throw e;
  }
}

function rowToDto(row: Reaction): {
  id: string;
  userId: string;
  targetId: string;
  reaction: string;
  createdAt: string;
} {
  return {
    id: row.id,
    userId: row.userId,
    targetId: row.targetId,
    reaction: row.reaction,
    createdAt: row.createdAt.toISOString(),
  };
}

function buildCursorPredicate(
  cursor: ReactionCursor | null,
): Prisma.ReactionWhereInput | undefined {
  if (!cursor) return undefined;
  // (createdAt, id) < (cursor.createdAt, cursor.id) under desc/desc order.
  return {
    OR: [
      { createdAt: { lt: cursor.createdAt } },
      {
        AND: [{ createdAt: cursor.createdAt }, { id: { lt: cursor.id } }],
      },
    ],
  };
}

export interface ListGivenInput {
  userId: string;
  reactions?: string[];
  cursor?: string;
  limit?: number;
}

export interface ListByUserInput {
  targetIds: string[];
  reactions?: string[];
  excludeUserId?: string;
  cursor?: string;
  limit?: number;
}

export interface ReactionListResult {
  items: ReturnType<typeof rowToDto>[];
  nextCursor: string | null;
}

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

  /**
   * List a user's own reaction events in reverse-chronological order,
   * paged with an opaque `(createdAt, id)` cursor.
   */
  async listGiven(input: ListGivenInput): Promise<ReactionListResult> {
    const limit = clampLimit(input.limit);
    const cursor = decodeOptionalCursor(input.cursor);

    const where: Prisma.ReactionWhereInput = {
      userId: input.userId,
      ...(input.reactions && input.reactions.length > 0
        ? { reaction: { in: input.reactions } }
        : {}),
      ...(buildCursorPredicate(cursor) ?? {}),
    };

    const rows = await prisma.reaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null;

    return { items: sliced.map(rowToDto), nextCursor };
  }

  /**
   * List reactions placed on a given set of target ids, optionally excluding
   * a specific user. Used by the main server to render Received history.
   */
  async listByUser(input: ListByUserInput): Promise<ReactionListResult> {
    if (input.targetIds.length > MAX_TARGET_IDS) {
      throw new TargetIdsOverflowError();
    }
    if (input.targetIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const limit = clampLimit(input.limit);
    const cursor = decodeOptionalCursor(input.cursor);

    const where: Prisma.ReactionWhereInput = {
      targetId: { in: input.targetIds },
      ...(input.reactions && input.reactions.length > 0
        ? { reaction: { in: input.reactions } }
        : {}),
      ...(input.excludeUserId ? { userId: { not: input.excludeUserId } } : {}),
      ...(buildCursorPredicate(cursor) ?? {}),
    };

    const rows = await prisma.reaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
    });

    const hasMore = rows.length > limit;
    const sliced = hasMore ? rows.slice(0, limit) : rows;
    const last = sliced[sliced.length - 1];
    const nextCursor =
      hasMore && last
        ? encodeCursor({ createdAt: last.createdAt, id: last.id })
        : null;

    return { items: sliced.map(rowToDto), nextCursor };
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
