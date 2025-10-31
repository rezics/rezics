import {prisma} from '@/prisma/client';
import {UnitStatus, UnitType} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import type {ReviewWithRelations} from './types';
import {reviewInclude} from './types';
import type {
  CreateReviewInput,
  UpdateReviewInput,
  ReviewListQuery,
} from '@package/contract';
import {getReviewApproxCount} from './sql.ts';

export class ReviewService {
  private buildWhereClause(options: ReviewListQuery): Prisma.UnitWhereInput {
    const andWhere: Prisma.UnitWhereInput[] = [];
    // Type constraint
    andWhere.push({type: UnitType.REVIEW});

    // Search by q in title/content
    if (options.q && options.q.trim()) {
      andWhere.push({
        OR: [
          {title: {contains: options.q, mode: 'insensitive'}},
          {content: {contains: options.q, mode: 'insensitive'}},
        ],
      });
    }

    // Filter by userId (author of review)
    if (options.userId && options.userId.trim()) {
      andWhere.push({userId: options.userId});
    }

    // Filter by target book unitId(s)
    const bookList = (options.bookIds ?? options.bookId ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (bookList.length > 0) {
      andWhere.push({targetUnitId: {in: bookList}});
    }

    // Filter by tags
    const tagList = (options.tags ?? options.tag ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      andWhere.push({
        tags: {
          some: {name: {in: tagList}},
        },
      });
    }

    // Filter by rating range (stored in metadata.rating)
    if (typeof options.ratingMin === 'number') {
      andWhere.push({
        metadata: {path: ['rating'], gte: options.ratingMin} as any,
      });
    }
    if (typeof options.ratingMax === 'number') {
      andWhere.push({
        metadata: {path: ['rating'], lte: options.ratingMax} as any,
      });
    }

    return andWhere.length > 0 ? {AND: andWhere} : {};
  }

  async list(options: ReviewListQuery = {}): Promise<{
    reviews: ReviewWithRelations[];
    total: number;
  }> {
    const cursor = options.cursor;
    const hasCursor = !!(cursor?.id && cursor?.createdAt);
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const calculateSkip = () => {
      if (hasCursor) return 1;
      return options.start ?? 0;
    };
    const skipNum = calculateSkip();
    const where = this.buildWhereClause(options);

    // Sorting
    const sortType = options.sort?.type ?? 'createdAt';
    const sortOrder = (options.sort?.order as 'asc' | 'desc') ?? 'desc';
    const orderBy: Prisma.UnitOrderByWithRelationInput =
      sortType === 'updatedAt'
        ? {updatedAt: sortOrder}
        : {createdAt: sortOrder};

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy,
        skip: skipNum,
        cursor: hasCursor
          ? ({id: cursor!.id, createdAt: cursor!.createdAt} as any)
          : undefined,
        take: limitNum,
        include: reviewInclude,
      }),
      getReviewApproxCount(),
    ]);

    return {reviews: units as unknown as ReviewWithRelations[], total};
  }

  async getById(id: string): Promise<ReviewWithRelations> {
    const unit = await prisma.unit.findUniqueOrThrow({
      where: {id},
      include: reviewInclude,
    });
    return unit as unknown as ReviewWithRelations;
  }

  async create(req: CreateReviewInput): Promise<ReviewWithRelations> {
    const {userId, bookId, content, title, rating} = req;
    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.REVIEW,
        status: UnitStatus.ACTIVE,
        title: title || undefined,
        content,
        targetUnitId: bookId,
        metadata: {
          rating: typeof rating === 'number' ? rating : undefined,
        } as unknown as Prisma.InputJsonValue,
      },
      include: reviewInclude,
    });
    return unit as unknown as ReviewWithRelations;
  }

  async update(
    id: string,
    req: UpdateReviewInput,
  ): Promise<ReviewWithRelations> {
    const {content, title, rating} = req;
    const unit = await prisma.unit.update({
      where: {id},
      data: {
        content: content ?? undefined,
        title: title ?? undefined,
        metadata: (rating !== undefined
          ? ({rating} as unknown as Prisma.InputJsonValue)
          : (undefined as unknown)) as any,
      },
      include: reviewInclude,
    });
    return unit as unknown as ReviewWithRelations;
  }

  async delete(id: string): Promise<void> {
    await prisma.unit.delete({where: {id}});
  }
}

export const reviewService = new ReviewService();
