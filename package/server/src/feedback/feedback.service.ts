import type { CreateFeedbackInput, FeedbackListQuery } from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import type { Feedback, Prisma } from "#/prisma/client";
import { prisma } from "#/prisma/client";
import { serverJobProducer } from "@/job/job-boundary";

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

export class FeedbackService {
  async create(
    input: CreateFeedbackInput & { userId: string },
  ): Promise<Feedback> {
    const {
      userId,
      targetKind,
      targetId,
      addressedUnitId,
      url,
      content,
      type,
    } = input;
    const prismaTargetKind = targetKind
      ? upper<Prisma.ModerationTargetKind>(targetKind)
      : null;
    const normalizedTargetId = targetId ?? null;
    const created = await prisma.feedback.create({
      data: {
        userId,
        targetKind: prismaTargetKind,
        targetId: normalizedTargetId,
        addressedUnitId:
          addressedUnitId ??
          (prismaTargetKind === "UNIT" ? normalizedTargetId : null),
        url: url ?? null,
        content,
        type: type ?? "REPORT",
      },
    });
    await enqueueFeedbackSearch(created.id);
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
    if (query.targetKind) {
      where.targetKind = upper<Prisma.ModerationTargetKind>(query.targetKind);
    }
    if (query.targetId) {
      where.targetId = query.targetId;
    }
    if (query.addressedUnitId) {
      where.addressedUnitId = query.addressedUnitId;
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
    await enqueueFeedbackResolution(id);
    return updated;
  }
}

export const feedbackService = new FeedbackService();
