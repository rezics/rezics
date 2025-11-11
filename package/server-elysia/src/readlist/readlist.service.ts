import {prisma} from '@/prisma/client';
import {UnitStatus, UnitType} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import {
  readlistSelect,
  type ReadlistSelected,
  readlistListSelect,
  type ReadlistListSelect,
} from './types';
import type {
  ReadlistListQuery,
  CreateReadlistInput,
  UpdateReadlistInput,
} from '@package/contract';
import type {ReadlistDTO} from '@package/contract';
import {mapReadlistListRowToDTO, mapReadlistRowToDTO} from './mapper';

export class ReadlistService {
  private buildWhere(options: ReadlistListQuery): Prisma.ReadListWhereInput {
    const and: Prisma.ReadListWhereInput[] = [
      {unit: {status: UnitStatus.ACTIVE, type: UnitType.READLIST}},
    ];

    if (options.q && options.q.trim()) {
      and.push({unit: {title: {contains: options.q, mode: 'insensitive'}}});
    }

    if (options.userId && options.userId.trim()) {
      and.push({unit: {userId: options.userId}});
    }

    const tagList = (options.tags ?? options.tag ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      and.push({unit: {tags: {some: {name: {in: tagList}}}}});
    }

    if (options.hasBookUnitId) {
      and.push({book: {some: {unitId: options.hasBookUnitId}}});
    }
    if (options.hasReviewUnitId) {
      and.push({review: {some: {id: options.hasReviewUnitId}}});
    }

    return and.length ? {AND: and} : {};
  }

  private buildOrderBy(
    options: ReadlistListQuery,
  ): Prisma.Enumerable<Prisma.ReadListOrderByWithRelationInput> {
    const order = (options.sort?.order ?? 'desc') as 'asc' | 'desc';
    const type = options.sort?.type ?? 'createdAt';
    if (type === 'likeCount')
      return [
        {unit: {reactions: {likeCount: order}}},
        {unit: {createdAt: 'desc'}},
        {unitId: 'desc'},
      ];
    if (type === 'commentCount')
      return [
        {unit: {stats: {commentCount: order}}},
        {unit: {createdAt: 'desc'}},
        {unitId: 'desc'},
      ];
    if (type === 'viewCount')
      return [
        {unit: {stats: {viewCount: order}}},
        {unit: {createdAt: 'desc'}},
        {unitId: 'desc'},
      ];
    if (type === 'updatedAt')
      return [{unit: {updatedAt: order}}, {unitId: 'desc'}];
    if (type === 'publishedAt')
      return [{unit: {publishedAt: order}}, {unitId: 'desc'}];
    return [{unit: {createdAt: order}}, {unitId: 'desc'}];
  }

  // Mapping moved to mapper.ts

  async list(
    options: ReadlistListQuery = {},
  ): Promise<{readlists: ReadlistDTO[]; total: number}> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const hasCursor = Boolean(options.cursor?.id);
    const skipNum = hasCursor ? 1 : options.start ?? 0;
    const where = this.buildWhere(options);
    const orderBy = this.buildOrderBy(options);

    const [rows, total] = await Promise.all([
      prisma.readList.findMany({
        where,
        orderBy,
        skip: skipNum,
        cursor: hasCursor ? {unitId: options.cursor!.id!} : undefined,
        take: limitNum,
        select: readlistListSelect,
      }),
      prisma.readList.count({where}),
    ]);

    return {readlists: rows.map(r => mapReadlistListRowToDTO(r)), total};
  }

  async getByUnitId(unitId: string): Promise<ReadlistDTO> {
    const row = await prisma.readList.findFirstOrThrow({
      where: {unitId},
      select: readlistSelect,
    });
    return mapReadlistRowToDTO(row);
  }

  async create(req: CreateReadlistInput): Promise<ReadlistDTO> {
    const {userId, title, coverUrl, items, bookIds} = req;

    // Create Unit first (1:1 with ReadList)
    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.READLIST,
        status: UnitStatus.ACTIVE,
        title,
        metadata: {coverUrl: coverUrl || undefined} as Prisma.InputJsonValue,
      },
    });

    // Collect relations from inputs
    const connectBookIds = new Set<string>();
    const connectReviewIds = new Set<string>();
    if (Array.isArray(items)) {
      for (const it of items) {
        if (it.bookUnitId) connectBookIds.add(it.bookUnitId);
        if (it.reviewUnitId) connectReviewIds.add(it.reviewUnitId);
      }
    }
    if (Array.isArray(bookIds)) {
      for (const bid of bookIds) connectBookIds.add(bid);
    }

    const row = await prisma.readList.create({
      data: {
        unitId: unit.id,
        book: connectBookIds.size
          ? {connect: Array.from(connectBookIds).map(id => ({unitId: id}))}
          : undefined,
        review: connectReviewIds.size
          ? {connect: Array.from(connectReviewIds).map(id => ({id}))}
          : undefined,
      },
      select: readlistSelect,
    });

    return mapReadlistRowToDTO(row);
  }

  async update(unitId: string, req: UpdateReadlistInput): Promise<ReadlistDTO> {
    // Prepare metadata update
    const unit = await prisma.unit.findUniqueOrThrow({where: {id: unitId}});
    const meta = ((unit.metadata ?? {}) as any) || {};
    if (typeof req.coverUrl !== 'undefined')
      meta.coverUrl = req.coverUrl || undefined;

    // Derive relation sets if provided
    const booksSet = new Set<string>();
    const reviewsSet = new Set<string>();
    if (Array.isArray(req.items)) {
      for (const it of req.items) {
        if (it.bookUnitId) booksSet.add(it.bookUnitId);
        if (it.reviewUnitId) reviewsSet.add(it.reviewUnitId);
      }
    }
    if (Array.isArray(req.bookIds)) {
      for (const id of req.bookIds) booksSet.add(id);
    }

    const data: Prisma.ReadListUpdateInput = {
      unit: {
        update: {
          title: req.title || undefined,
          metadata: meta as Prisma.InputJsonValue,
        },
      },
    };

    if (booksSet.size > 0) {
      (data as any).book = {
        set: Array.from(booksSet).map(id => ({unitId: id})),
      } satisfies Prisma.BookUpdateManyWithoutReadListNestedInput;
    }
    if (reviewsSet.size > 0) {
      (data as any).review = {
        set: Array.from(reviewsSet).map(id => ({id})),
      } satisfies Prisma.UnitUpdateManyWithoutReviewForReadListNestedInput;
    }

    const row = await prisma.readList.update({
      where: {unitId},
      data,
      select: readlistSelect,
    });
    return mapReadlistRowToDTO(row);
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({where: {id: unitId}});
  }
}

export const readlistService = new ReadlistService();
