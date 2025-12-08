import {prisma} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import type {
  CreateFeedbackInput,
  FeedbackListQuery,
  FeedbackListResponse,
} from '@package/contract';
import {mapFeedbackToDTO} from './mapper';
import {syncFeedbackToMeili} from '@/src/meili/feedback/sync';

export class FeedbackService {
  async create(
    input: CreateFeedbackInput & {userId: string},
  ): Promise<ReturnType<typeof mapFeedbackToDTO>> {
    const {userId, unitId, url, content, type} = input;
    const created = await prisma.feedback.create({
      data: {
        userId,
        unitId: unitId ?? null,
        url: url ?? null,
        content,
        type: type ?? 'REPORT',
      },
    });
    await syncFeedbackToMeili(created.id);
    return mapFeedbackToDTO(created);
  }

  async getById(id: string) {
    const feedback = await prisma.feedback.findUniqueOrThrow({
      where: {id},
    });
    return mapFeedbackToDTO(feedback);
  }

  /**
   * Generic list with rich filters for admin / per-user queries
   */
  async list(query: FeedbackListQuery): Promise<FeedbackListResponse> {
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
    if (typeof query.resolved === 'boolean') {
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

    const [rows, total] = await Promise.all([
      prisma.feedback.findMany({
        where,
        orderBy: {createdAt: 'desc'},
        skip: offset,
        take: limit,
      }),
      prisma.feedback.count({where}),
    ]);

    return {
      items: rows.map(mapFeedbackToDTO),
      offset,
      totalItems: total,
    };
  }

  /**
   * Mark a feedback as resolved / unresolved.
   * - When setting resolved=true, resolvedAt is set to now.
   * - When setting resolved=false, resolvedAt is cleared.
   */
  async setResolved(id: string, resolved: boolean) {
    const data: Prisma.FeedbackUpdateInput = {
      resolved,
      resolvedAt: resolved ? new Date() : null,
    };
    const updated = await prisma.feedback.update({
      where: {id},
      data,
    });
    await syncFeedbackToMeili(id);
    return mapFeedbackToDTO(updated);
  }
}

export const feedbackService = new FeedbackService();
