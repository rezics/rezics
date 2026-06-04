import { and, asc, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import type { ServerDb } from "./client";
import { historyOutbox } from "./schema";

const CLAIMABLE_STATUSES = ["pending", "failed"] as const;

type FindManyInput = {
  where?: {
    id?: string;
    status?: { in?: string[] };
    OR?: Array<{ nextAttemptAt: null } | { nextAttemptAt: { lte: Date } }>;
  };
  take?: number;
};

type UpdateManyInput = {
  where: {
    id: string;
    status?: { in?: string[] };
    attempts?: number;
  };
  data: {
    attempts?: { increment: number };
    status?: string;
    nextAttemptAt?: Date | null;
    lastError?: string | null;
    processedById?: string;
  };
};

type UpdateInput = {
  where: { id: string };
  data: {
    status?: string;
    processedAt?: Date | null;
    nextAttemptAt?: Date | null;
    lastError?: string | null;
  };
};

function claimableAttemptCondition(now?: Date) {
  return now
    ? or(
        isNull(historyOutbox.nextAttemptAt),
        lte(historyOutbox.nextAttemptAt, now),
      )
    : undefined;
}

export function createServerHistoryOutboxRepository(database: ServerDb) {
  return {
    historyOutbox: {
      async findMany(input: FindManyInput = {}) {
        const statuses =
          input.where?.status?.in && input.where.status.in.length > 0
            ? input.where.status.in
            : [...CLAIMABLE_STATUSES];
        const retryBefore = input.where?.OR?.find(
          (condition): condition is { nextAttemptAt: { lte: Date } } =>
            typeof (condition as any).nextAttemptAt === "object" &&
            (condition as any).nextAttemptAt?.lte instanceof Date,
        )?.nextAttemptAt.lte;

        return database
          .select()
          .from(historyOutbox)
          .where(
            and(
              input.where?.id
                ? eq(historyOutbox.id, input.where.id)
                : undefined,
              inArray(historyOutbox.status, statuses),
              claimableAttemptCondition(retryBefore),
            ),
          )
          .orderBy(asc(historyOutbox.createdAt))
          .limit(input.take ?? 25);
      },

      async updateMany(input: UpdateManyInput) {
        const updated = await database
          .update(historyOutbox)
          .set({
            ...("status" in input.data ? { status: input.data.status } : {}),
            ...("nextAttemptAt" in input.data
              ? { nextAttemptAt: input.data.nextAttemptAt }
              : {}),
            ...("lastError" in input.data
              ? { lastError: input.data.lastError }
              : {}),
            ...(input.data.processedById
              ? { processedById: input.data.processedById }
              : {}),
            ...(input.data.attempts?.increment
              ? {
                  attempts: sql`${historyOutbox.attempts} + ${input.data.attempts.increment}`,
                }
              : {}),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(historyOutbox.id, input.where.id),
              input.where.status?.in
                ? inArray(historyOutbox.status, input.where.status.in)
                : undefined,
              input.where.attempts !== undefined
                ? eq(historyOutbox.attempts, input.where.attempts)
                : undefined,
            ),
          )
          .returning({ id: historyOutbox.id });
        return { count: updated.length };
      },

      async update(input: UpdateInput) {
        const [row] = await database
          .update(historyOutbox)
          .set({
            ...("status" in input.data ? { status: input.data.status } : {}),
            ...("processedAt" in input.data
              ? { processedAt: input.data.processedAt }
              : {}),
            ...("nextAttemptAt" in input.data
              ? { nextAttemptAt: input.data.nextAttemptAt }
              : {}),
            ...("lastError" in input.data
              ? { lastError: input.data.lastError }
              : {}),
            updatedAt: new Date(),
          })
          .where(eq(historyOutbox.id, input.where.id))
          .returning();
        if (!row)
          throw new Error(`HistoryOutbox row not found: ${input.where.id}`);
        return row;
      },
    },
  };
}
