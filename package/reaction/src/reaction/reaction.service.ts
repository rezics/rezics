import { normalizeReactionScopeKey } from "@rezics/contract/reaction";
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
const DEFAULT_ACTIVE_REACTION_QUOTA = 3;

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

export class ReactionQuotaExceededError extends Error {
  readonly statusCode = 409;
  constructor() {
    super(
      `Active reaction quota exceeded for target; limit is ${DEFAULT_ACTIVE_REACTION_QUOTA}`,
    );
    this.name = "ReactionQuotaExceededError";
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
  scopeKey: string;
  createdAt: string;
} {
  return {
    id: row.id,
    userId: row.userId,
    targetId: row.targetId,
    reaction: row.reaction,
    scopeKey: row.scopeKey,
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
  scopeKey?: string;
  cursor?: string;
  limit?: number;
}

export interface ListByUserInput {
  targetIds: string[];
  reactions?: string[];
  scopeKey?: string;
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
    scopeKey?: string,
  ): Promise<Record<string, Record<string, number>>> {
    if (!targetIds.length) return {};

    const result: Record<string, Record<string, number>> = {};
    for (const id of targetIds) {
      result[id] = {};
    }

    const normalizedScopeKey =
      scopeKey === undefined ? undefined : normalizeReactionScopeKey(scopeKey);
    const rows =
      normalizedScopeKey === undefined
        ? await prisma.reactionSummary.groupBy({
            by: ["targetId", "reaction"],
            where: { targetId: { in: targetIds } },
            _sum: { count: true },
          })
        : await prisma.reactionSummary.findMany({
            where: {
              targetId: { in: targetIds },
              scopeKey: normalizedScopeKey,
            },
          });

    for (const row of rows) {
      const target = result[row.targetId];
      if (!target) continue;
      target[row.reaction] = "count" in row ? row.count : (row._sum.count ?? 0);
    }
    return result;
  }

  /** Get current user's reaction types for one or more targets. */
  async getUserReactions(
    userId: string,
    targetIds: string[],
    scopeKey?: string,
  ): Promise<Record<string, string[]>> {
    if (!targetIds.length) return {};
    const normalizedScopeKey = normalizeReactionScopeKey(scopeKey);

    const rows = await prisma.reaction.findMany({
      where: {
        userId,
        targetId: { in: targetIds },
        scopeKey: normalizedScopeKey,
      },
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
    scopeKey?: string,
  ): Promise<{ reaction: Reaction; created: boolean }> {
    if (!allowedReactionTypes.has(reaction)) {
      throw new Error(`Invalid reaction type: ${reaction}`);
    }
    const normalizedScopeKey = normalizeReactionScopeKey(scopeKey);

    // Scoped reaction identity and active-count quota live together here. The
    // main server validates realm policy before forwarding scoped writes.
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findUnique({
        where: {
          userId_targetId_reaction_scopeKey: {
            userId,
            targetId,
            reaction,
            scopeKey: normalizedScopeKey,
          },
        },
      });
      if (existing) return { reaction: existing, created: false };

      await tx.reactionTargetUsage.upsert({
        where: { userId_targetId: { userId, targetId } },
        create: {
          userId,
          targetId,
          activeCount: 0,
          maxActive: DEFAULT_ACTIVE_REACTION_QUOTA,
        },
        update: {},
      });
      const usage = await tx.reactionTargetUsage.updateMany({
        where: {
          userId,
          targetId,
          activeCount: { lt: tx.reactionTargetUsage.fields.maxActive },
        },
        data: { activeCount: { increment: 1 } },
      });
      if (usage.count !== 1) throw new ReactionQuotaExceededError();

      const created = await tx.reaction.create({
        data: { userId, targetId, reaction, scopeKey: normalizedScopeKey },
      });

      await tx.reactionSummary.upsert({
        where: {
          targetId_reaction_scopeKey: {
            targetId,
            reaction,
            scopeKey: normalizedScopeKey,
          },
        },
        create: { targetId, reaction, scopeKey: normalizedScopeKey, count: 1 },
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
      ...(input.scopeKey
        ? { scopeKey: normalizeReactionScopeKey(input.scopeKey) }
        : {}),
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
      ...(input.scopeKey
        ? { scopeKey: normalizeReactionScopeKey(input.scopeKey) }
        : {}),
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
    scopeKey?: string,
  ): Promise<{ deleted: boolean }> {
    const normalizedScopeKey = normalizeReactionScopeKey(scopeKey);
    return await prisma.$transaction(async (tx) => {
      const existing = await tx.reaction.findUnique({
        where: {
          userId_targetId_reaction_scopeKey: {
            userId,
            targetId,
            reaction,
            scopeKey: normalizedScopeKey,
          },
        },
        select: { id: true },
      });
      if (!existing) return { deleted: false };

      await tx.reaction.delete({
        where: {
          userId_targetId_reaction_scopeKey: {
            userId,
            targetId,
            reaction,
            scopeKey: normalizedScopeKey,
          },
        },
      });

      await tx.reactionSummary
        .update({
          where: {
            targetId_reaction_scopeKey: {
              targetId,
              reaction,
              scopeKey: normalizedScopeKey,
            },
          },
          data: { count: { decrement: 1 } },
        })
        .catch(() => {});
      await tx.reactionTargetUsage
        .update({
          where: { userId_targetId: { userId, targetId } },
          data: { activeCount: { decrement: 1 } },
        })
        .catch(() => {});

      return { deleted: true };
    });
  }
}

export const reactionService = new ReactionService();
