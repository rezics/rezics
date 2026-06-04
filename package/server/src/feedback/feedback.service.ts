import type { CreateFeedbackInput, FeedbackListQuery } from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, count, desc, eq, gte, inArray, lte, type SQL } from "drizzle-orm";
import { Feedback } from "../db/schema";
import { serverJobProducer } from "../job/job-boundary";
import { AppError } from "../utils/errors";

export type FeedbackRow = typeof Feedback.$inferSelect;
type ModerationTargetKindValue = NonNullable<FeedbackRow["targetKind"]>;
type FeedbackTypeValue = FeedbackRow["type"];

type FeedbackCreateData = {
  userId: string;
  targetKind: ModerationTargetKindValue | null;
  targetId: string | null;
  addressedUnitId: string | null;
  url: string | null;
  content: string;
  type: FeedbackTypeValue;
};

export type FeedbackRepository = {
  create(data: FeedbackCreateData): Promise<FeedbackRow>;
  getById(id: string): Promise<FeedbackRow | undefined>;
  list(input: {
    query: FeedbackListQuery;
    offset: number;
    limit: number;
  }): Promise<{ rows: FeedbackRow[]; total: number }>;
  setResolved(id: string, resolved: boolean): Promise<FeedbackRow>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function enqueueFeedbackSearch(feedbackId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.feedbackSync,
      { feedbackId },
      { type: "server", service: "feedback" },
    ),
  );
}

function enqueueFeedbackResolution(feedbackId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.feedbackPatchResolution,
      { feedbackId },
      { type: "server", service: "feedback" },
    ),
  );
}

function upper<T extends string>(value: string): T {
  return value.toUpperCase() as T;
}

function buildFeedbackConditions(query: FeedbackListQuery): SQL[] {
  const conditions: SQL[] = [];

  if (query.userId) {
    conditions.push(eq(Feedback.userId, query.userId));
  }
  if (query.targetKind) {
    conditions.push(
      eq(
        Feedback.targetKind,
        upper<ModerationTargetKindValue>(query.targetKind),
      ),
    );
  }
  if (query.targetId) {
    conditions.push(eq(Feedback.targetId, query.targetId));
  }
  if (query.addressedUnitId) {
    conditions.push(eq(Feedback.addressedUnitId, query.addressedUnitId));
  }
  if (typeof query.resolved === "boolean") {
    conditions.push(eq(Feedback.resolved, query.resolved));
  }
  if (query.type) {
    conditions.push(eq(Feedback.type, upper<FeedbackTypeValue>(query.type)));
  }
  if (query.createdAtFrom) {
    conditions.push(gte(Feedback.createdAt, new Date(query.createdAtFrom)));
  }
  if (query.createdAtTo) {
    conditions.push(lte(Feedback.createdAt, new Date(query.createdAtTo)));
  }

  const idList = parseIdsCsv(query.ids);
  if (idList && idList.length > 0) {
    conditions.push(inArray(Feedback.id, idList));
  }

  return conditions;
}

function createDrizzleFeedbackRepository(): FeedbackRepository {
  return {
    async create(data) {
      const db = await getServerDb();
      const [row] = await db
        .insert(Feedback)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning();
      if (!row) {
        throw new AppError(500, "Feedback was not created", {
          code: "feedback_create_failed",
        });
      }
      return row;
    },

    async getById(id) {
      const db = await getServerDb();
      const [row] = await db
        .select()
        .from(Feedback)
        .where(eq(Feedback.id, id))
        .limit(1);
      return row;
    },

    async list({ query, offset, limit }) {
      const db = await getServerDb();
      const conditions = buildFeedbackConditions(query);
      const where = conditions.length ? and(...conditions) : undefined;
      const [rows, totalRows] = await Promise.all([
        db
          .select()
          .from(Feedback)
          .where(where)
          .orderBy(desc(Feedback.createdAt))
          .offset(offset)
          .limit(limit),
        db.select({ total: count() }).from(Feedback).where(where),
      ]);
      return { rows, total: totalRows[0]?.total ?? 0 };
    },

    async setResolved(id, resolved) {
      const db = await getServerDb();
      const [row] = await db
        .update(Feedback)
        .set({
          resolved,
          resolvedAt: resolved ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(Feedback.id, id))
        .returning();
      if (!row) {
        throw new AppError(404, "Feedback not found", {
          code: "feedback_not_found",
          details: { id },
        });
      }
      return row;
    },
  };
}

export class FeedbackService {
  constructor(
    private readonly repository = createDrizzleFeedbackRepository(),
  ) {}

  async create(
    input: CreateFeedbackInput & { userId: string },
  ): Promise<FeedbackRow> {
    const {
      userId,
      targetKind,
      targetId,
      addressedUnitId,
      url,
      content,
      type,
    } = input;
    const storageTargetKind = targetKind
      ? upper<ModerationTargetKindValue>(targetKind)
      : null;
    const normalizedTargetId = targetId ?? null;
    const created = await this.repository.create({
      userId,
      targetKind: storageTargetKind,
      targetId: normalizedTargetId,
      addressedUnitId:
        addressedUnitId ??
        (storageTargetKind === "UNIT" ? normalizedTargetId : null),
      url: url ?? null,
      content,
      type: type ? upper<FeedbackTypeValue>(type) : "REPORT",
    });
    await enqueueFeedbackSearch(created.id);
    return created;
  }

  async getById(id: string): Promise<FeedbackRow> {
    const row = await this.repository.getById(id);
    if (!row) {
      throw new AppError(404, "Feedback not found", {
        code: "feedback_not_found",
        details: { id },
      });
    }
    return row;
  }

  /**
   * Generic list with rich filters for admin / per-user queries
   */
  async list(
    query: FeedbackListQuery,
  ): Promise<{ items: FeedbackRow[]; offset: number; totalItems: number }> {
    const offset = Number.isFinite(query.offset as number)
      ? Number(query.offset)
      : 0;
    const rawLimit = Number.isFinite(query.limit as number)
      ? Number(query.limit)
      : 20;
    const limit = Math.max(1, Math.min(rawLimit, 100));

    const { rows, total } = await this.repository.list({
      query,
      offset,
      limit,
    });

    return {
      items: rows,
      offset,
      totalItems: total,
    };
  }

  /**
   * Mark a feedback as resolved / unresolved.
   * - When setting resolved=true, resolvedAt is set to now.
   * - When setting resolved=false, resolvedAt is cleared.
   */
  async setResolved(id: string, resolved: boolean): Promise<FeedbackRow> {
    const updated = await this.repository.setResolved(id, resolved);
    await enqueueFeedbackResolution(id);
    return updated;
  }
}

export const feedbackService = new FeedbackService();
