import {prisma} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import {UnitType, UnitStatus} from '@/prisma/client';
import type {CreateCommentInput, UpdateCommentInput} from '@package/contract';
import {commentInclude} from './types';
import type {CommentWithRelations} from './types';
import {getCommentApproxCount} from './sql';

export class CommentService {
  /** List comments under a root unit, optionally restricted to a parent (direct children) */
  async list(
    rootUnitId: string,
    options: {
      parentId?: string;
      maxDepth?: number;
      start?: number;
      limit?: number;
      order?: 'asc' | 'desc';
    } = {},
  ) {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 50), 200));
    const skipNum = options.start ?? 0;
    const order = options.order ?? 'asc';

    const where: Prisma.CommentIndexWhereInput = {rootUnitId};

    if (options.parentId) {
      where.parentCommentId = options.parentId;
    } else if (typeof options.maxDepth === 'number') {
      where.depth = {lte: options.maxDepth};
    }

    const [rows, total] = await Promise.all([
      prisma.commentIndex.findMany({
        where,
        orderBy: [{unit: {createdAt: order}}],
        skip: skipNum,
        take: limitNum,
        include: commentInclude,
      }),
      getCommentApproxCount(), // approximate total across all comments (not filtered)
    ]);

    return rows as CommentWithRelations[];
  }

  /** Get single comment by Unit id */
  async getByUnitId(unitId: string): Promise<CommentWithRelations> {
    const comment = await prisma.commentIndex.findUniqueOrThrow({
      where: {unitId},
      include: commentInclude,
    });
    return comment as CommentWithRelations;
  }

  /** Create a comment (Unit + CommentIndex) */
  async create(
    input: CreateCommentInput & {userId: string},
  ): Promise<CommentWithRelations> {
    const {rootPostId, parentCommentId, content, userId} = input;

    let depth = 0;
    if (parentCommentId) {
      const parent = await prisma.commentIndex.findUnique({
        where: {unitId: parentCommentId},
        select: {depth: true, rootUnitId: true},
      });
      if (!parent) throw new Error('Parent comment not found');
      if (parent.rootUnitId !== rootPostId)
        throw new Error('Parent comment belongs to a different root');
      depth = parent.depth + 1;
    }

    const created = await prisma.commentIndex.create({
      data: {
        unit: {
          create: {
            userId,
            type: UnitType.COMMENT,
            status: UnitStatus.ACTIVE,
            content,
          },
        },
        rootUnit: {connect: {id: rootPostId}},
        parentComment: parentCommentId
          ? {connect: {id: parentCommentId}}
          : undefined,
        depth,
      },
      include: commentInclude,
    });
    return created as CommentWithRelations;
  }

  /** Update comment content (only content mutable for now) */
  async update(
    unitId: string,
    input: UpdateCommentInput,
  ): Promise<CommentWithRelations> {
    const updated = await prisma.commentIndex.update({
      where: {unitId},
      data: {
        unit: {update: {content: input.content}},
      },
      include: commentInclude,
    });
    return updated as CommentWithRelations;
  }

  /** Delete comment */
  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({where: {id: unitId}}); // cascades CommentIndex
  }

  async exists(unitId: string): Promise<boolean> {
    const count = await prisma.commentIndex.count({where: {unitId}});
    return count > 0;
  }
}

export const commentService = new CommentService();
