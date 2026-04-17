import type { CreateFeedbackInput, FeedbackListQuery } from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import type { Feedback, Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { syncFeedbackToMeili, patchFeedbackResolutionToMeili } from "@/meili/feedback/sync";

export class FeedbackService {
  async create(
    input: CreateFeedbackInput & { userId: string },
  ): Promise<Feedback> {
    const { userId, unitId, url, content, type } = input;
    const created = await prisma.feedback.create({
      data: {
        userId,
        unitId: unitId ?? null,
        url: url ?? null,
        content,
        type: type ?? "REPORT",
      },
    });
    await syncFeedbackToMeili(created.id);
    return created;
  }

  async getById(id: string): Promise<Feedback> {
    return prisma.feedback.findUniqueOrThrow({
      where: { id },
    });
  }

  /**
   * Generic list with rich filters for admin / per-user queries
   */
  async list(
    query: FeedbackListQuery,
  ): Promise<{ items: Feedback[]; offset: number; totalItems: number }> {
    const offset = Number.isFinite(query.offset as number)
      ? Number(query.offset)
      : 0;
    const rawLimit = Number.isFinite(query.limit as number)
      ? Number(query.limit)
      : 20;
    const limit = Math.max(1, Math.min(rawLimit, 100));

    const where: Prisma.FeedbackWhereInput = {};

    if (query.userId) {
      where.userId = query.userId;
    }
    if (query.unitId) {
      where.unitId = query.unitId;
    }
    if (typeof query.resolved === "boolean") {
      where.resolved = query.resolved;
    }
    if (query.type) {
      where.type = query.type as any;
    }
    if (query.createdAtFrom || query.createdAtTo) {
      where.createdAt = {};
      if (query.createdAtFrom) {
        (where.createdAt as Prisma.DateTimeFilter).gte = new Date(
          query.createdAtFrom,
        );
      }
      if (query.createdAtTo) {
        (where.createdAt as Prisma.DateTimeFilter).lte = new Date(
          query.createdAtTo,
        );
      }
    }

    const idList = parseIdsCsv(query.ids);
    if (idList && idList.length > 0) {
      where.id = { in: idList };
    }

    const [rows, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      prisma.feedback.count({ where }),
    ]);

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
  async setResolved(id: string, resolved: boolean): Promise<Feedback> {
    const data: Prisma.FeedbackUpdateInput = {
      resolved,
      resolvedAt: resolved ? new Date() : null,
    };
    const updated = await prisma.feedback.update({
      where: { id },
      data,
    });
    await patchFeedbackResolutionToMeili(id, {
      resolved: updated.resolved,
      resolvedAt: updated.resolvedAt?.toISOString() ?? null,
    });
    return updated;
  }
}

export const feedbackService = new FeedbackService();
