import {prisma} from '@/prisma/client';
import {UnitStatus, UnitType} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import type {ReadlistWithRelations} from './types';
import {readlistInclude} from './types';
import type {
  ReadlistListQuery,
  CreateReadlistInput,
  UpdateReadlistInput,
} from '@package/contract';

export class ReadlistService {
  // Safely fetch matching Unit IDs by JSONB containment on metadata.items
  private async getIdsByJsonContain(options: {
    hasBookUnitId?: string;
    hasReviewUnitId?: string;
  }): Promise<string[] | undefined> {
    const {hasBookUnitId, hasReviewUnitId} = options;
    if (!hasBookUnitId && !hasReviewUnitId) return undefined;

    const fetchByJson = async (jsonObj: any) => {
      const jsonStr = JSON.stringify(jsonObj);
      const rows = await prisma.$queryRaw<{id: string}[]>`
        SELECT id FROM "Unit"
        WHERE type = 'READLIST' AND status = 'ACTIVE' AND metadata @> ${jsonStr}::jsonb
      `;
      return rows.map(r => r.id);
    };

    const lists: string[][] = [];
    if (hasBookUnitId) {
      lists.push(await fetchByJson({items: [{bookUnitId: hasBookUnitId}]}));
    }
    if (hasReviewUnitId) {
      lists.push(await fetchByJson({items: [{reviewUnitId: hasReviewUnitId}]}));
    }
    if (lists.length === 1) return lists[0];
    // Intersect if both provided
    const [first, ...rest] = lists;
    const set = new Set(first);
    for (const arr of rest) {
      for (const id of Array.from(set)) {
        if (!arr.includes(id)) set.delete(id);
      }
    }
    return Array.from(set);
  }

  private buildWhereClause = async (
    options: ReadlistListQuery,
  ): Promise<Prisma.UnitWhereInput> => {
    const andWhere: Prisma.UnitWhereInput[] = [
      {type: UnitType.READLIST},
      {status: UnitStatus.ACTIVE},
    ];

    if (options.q && options.q.trim()) {
      andWhere.push({title: {contains: options.q, mode: 'insensitive'}});
    }

    if (options.userId && options.userId.trim()) {
      andWhere.push({userId: options.userId});
    }

    const tagList = (options.tags ?? options.tag ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      andWhere.push({
        tags: {some: {name: {in: tagList}}},
      });
    }

    // JSON containment filters via raw to get matching ids
    if (options.hasBookUnitId || options.hasReviewUnitId) {
      const ids = await this.getIdsByJsonContain({
        hasBookUnitId: options.hasBookUnitId,
        hasReviewUnitId: options.hasReviewUnitId,
      });
      if (ids && ids.length > 0) {
        andWhere.push({id: {in: ids}});
      } else {
        // No matches
        andWhere.push({id: {in: ['__none__']}});
      }
    }

    return andWhere.length > 0 ? {AND: andWhere} : {};
  };

  private buildOrderBy(
    options: ReadlistListQuery,
  ): Prisma.Enumerable<Prisma.UnitOrderByWithRelationInput> {
    const order = (options.sort?.order ?? 'desc') as 'asc' | 'desc';
    const type = options.sort?.type ?? 'createdAt';
    if (type === 'likeCount')
      return [
        {reactions: {likeCount: order}},
        {createdAt: 'desc'},
        {id: 'desc'},
      ];
    if (type === 'commentCount')
      return [
        {stats: {commentCount: order}},
        {createdAt: 'desc'},
        {id: 'desc'},
      ];
    if (type === 'viewCount')
      return [{stats: {viewCount: order}}, {createdAt: 'desc'}, {id: 'desc'}];
    if (type === 'updatedAt') return [{updatedAt: order}, {id: 'desc'}];
    if (type === 'publishedAt') return [{publishedAt: order}, {id: 'desc'}];
    return [{createdAt: order}, {id: 'desc'}];
  }

  async list(
    options: ReadlistListQuery = {},
  ): Promise<{readlists: ReadlistWithRelations[]; total: number}> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const hasCursor = Boolean(options.cursor?.id);
    const skipNum = hasCursor ? 1 : options.start ?? 0;
    const where = await this.buildWhereClause(options);
    const orderBy = this.buildOrderBy(options);

    const [items, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy,
        skip: skipNum,
        cursor: hasCursor ? {id: options.cursor!.id!} : undefined,
        take: limitNum,
        include: readlistInclude,
      }),
      prisma.unit.count({where}),
    ]);

    return {readlists: items as ReadlistWithRelations[], total};
  }

  async getByUnitId(unitId: string): Promise<ReadlistWithRelations> {
    const u = await prisma.unit.findFirstOrThrow({
      where: {id: unitId, type: UnitType.READLIST},
      include: readlistInclude,
    });
    return u as ReadlistWithRelations;
  }

  async create(req: CreateReadlistInput): Promise<ReadlistWithRelations> {
    const {userId, title, coverUrl, items, bookIds} = req;
    const normalizedItems = Array.isArray(items)
      ? items
      : Array.isArray(bookIds)
      ? bookIds.map(bid => ({bookUnitId: bid}))
      : [];

    const metadata = {
      coverUrl: coverUrl || undefined,
      items: normalizedItems,
    } as Prisma.InputJsonValue;

    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.READLIST,
        status: UnitStatus.ACTIVE,
        title,
        metadata,
      },
      include: readlistInclude,
    });
    return unit as ReadlistWithRelations;
  }

  async update(
    unitId: string,
    req: UpdateReadlistInput,
  ): Promise<ReadlistWithRelations> {
    // Merge metadata
    const existing = await prisma.unit.findUniqueOrThrow({where: {id: unitId}});
    const currentMeta = ((existing.metadata ?? {}) as any) || {};
    const nextMeta: any = {...currentMeta};
    if (typeof req.coverUrl !== 'undefined')
      nextMeta.coverUrl = req.coverUrl || undefined;
    if (Array.isArray(req.items)) nextMeta.items = req.items;
    if (Array.isArray(req.bookIds)) {
      // back-compat: override items from bookIds if provided
      nextMeta.items = req.bookIds.map(bid => ({bookUnitId: bid}));
    }

    const unit = await prisma.unit.update({
      where: {id: unitId},
      data: {
        title: req.title || undefined,
        metadata: nextMeta as Prisma.InputJsonValue,
      },
      include: readlistInclude,
    });
    return unit as ReadlistWithRelations;
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({where: {id: unitId}});
  }
}

export const readlistService = new ReadlistService();
