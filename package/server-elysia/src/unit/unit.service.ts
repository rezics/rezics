import {prisma} from '@/prisma/client';
import type {Prisma} from '@/prisma/client';
import {UnitStatus, UnitType} from '@/prisma/client';
import type {
  UnitListQuery,
  CreateUnitInput,
  UpdateUnitInput,
  CommentTreeNode,
} from '@package/contract';
import {unitInclude} from './types';
import type {UnitWithRelations} from './types';
import {getUnitApproxCount} from './sql';

/**
 * Unit Service - Business logic for generic Unit entities and comment trees
 */
export class UnitService {
  /**
   * Build Prisma where clause for Unit list queries
   */
  private buildWhereClause(options: UnitListQuery): Prisma.UnitWhereInput {
    const andWhere: Prisma.UnitWhereInput[] = [];

    // Text search: title/content
    if (options.q && options.q.trim()) {
      andWhere.push({
        OR: [
          {title: {contains: options.q, mode: 'insensitive'}},
          {content: {contains: options.q, mode: 'insensitive'}},
        ],
      });
    }

    // Filter by type(s)
    const typeList = (options.types ?? options.type ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (typeList.length > 0)
      andWhere.push({type: {in: typeList as UnitType[]}});

    // Exclude types
    const excludeTypeList = (options.excludeTypes ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (excludeTypeList.length > 0)
      andWhere.push({NOT: {type: {in: excludeTypeList as UnitType[]}}});

    // Filter by status(es)
    const statusList = (options.statuses ?? options.status ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (statusList.length > 0)
      andWhere.push({status: {in: statusList as UnitStatus[]}});

    // Filter by userId(s)
    const userList = (options.userIds ?? options.userId ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (userList.length > 0) andWhere.push({userId: {in: userList}});

    // Filter by domain owner(s)
    const domainList = (options.domainIds ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (domainList.length > 0) {
      andWhere.push({
        domains: {some: {unitId: {in: domainList}}},
      });
    }

    // Target filters
    if (options.targetUnitId && options.targetUnitId.trim()) {
      andWhere.push({targetUnitId: options.targetUnitId});
    }
    if (options.hasTarget === 'true')
      andWhere.push({NOT: {targetUnitId: null}});
    if (options.hasTarget === 'false') andWhere.push({targetUnitId: null});

    // Tags
    const tagList = (options.tags ?? options.tag ?? '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      andWhere.push({tags: {some: {name: {in: tagList}}}});
    }

    // Date ranges
    if (options.createdAtFrom) {
      andWhere.push({createdAt: {gte: new Date(options.createdAtFrom)}});
    }
    if (options.createdAtTo) {
      andWhere.push({createdAt: {lte: new Date(options.createdAtTo)}});
    }
    if (options.publishedAtFrom) {
      andWhere.push({publishedAt: {gte: new Date(options.publishedAtFrom)}});
    }
    if (options.publishedAtTo) {
      andWhere.push({publishedAt: {lte: new Date(options.publishedAtTo)}});
    }

    return andWhere.length > 0 ? {AND: andWhere} : {};
  }

  /**
   * List Units with pagination and rich filters
   */
  async list(options: UnitListQuery = {}) {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skipNum = options.cursor?.unitId ? 1 : options.start ?? 0;

    const where = this.buildWhereClause(options);

    const sortField = options.sort?.field ?? 'createdAt';
    const sortOrder = (
      options.sort?.order?.toLowerCase() === 'asc' ? 'asc' : 'desc'
    ) as Prisma.SortOrder;

    const [units, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy: {[sortField]: sortOrder},
        skip: skipNum,
        cursor: options.cursor?.unitId
          ? {id: options.cursor.unitId}
          : undefined,
        take: limitNum,
        include: unitInclude,
      }),
      getUnitApproxCount(),
    ]);

    return {units: units as UnitWithRelations[], total};
  }

  /** Get a unit by id with relations */
  async getByUnitId(unitId: string): Promise<UnitWithRelations> {
    const unit = await prisma.unit.findUniqueOrThrow({
      where: {id: unitId},
      include: unitInclude,
    });
    return unit as UnitWithRelations;
  }

  /** Create a Unit */
  async create(input: CreateUnitInput): Promise<UnitWithRelations> {
    const unit = await prisma.unit.create({
      data: {
        userId: input.userId,
        type: input.type as UnitType,
        status: (input.status as UnitStatus) ?? UnitStatus.ACTIVE,
        title: input.title ?? undefined,
        content: input.content ?? undefined,
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        targetUnitId: input.targetUnitId ?? undefined,
        publishedAt: input.publishedAt
          ? new Date(input.publishedAt as any)
          : undefined,
      },
      include: unitInclude,
    });
    return unit as UnitWithRelations;
  }

  /** Update a Unit */
  async update(
    unitId: string,
    input: UpdateUnitInput,
  ): Promise<UnitWithRelations> {
    const unit = await prisma.unit.update({
      where: {id: unitId},
      data: {
        status: (input.status as UnitStatus | undefined) ?? undefined,
        title: input.title ?? undefined,
        content: input.content ?? undefined,
        metadata: (input.metadata ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        targetUnitId: input.targetUnitId ?? undefined,
        publishedAt: input.publishedAt
          ? new Date(input.publishedAt as any)
          : undefined,
      },
      include: unitInclude,
    });
    return unit as UnitWithRelations;
  }

  /** Delete a Unit by id (cascades) */
  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({where: {id: unitId}});
  }

  /**
   * Get a flat slice of comment tree under a root unit, optionally limited by parent (direct children)
   * - If parentId is provided, returns only direct children of that parent
   * - If parentId is omitted, returns all comments up to maxDepth from the root
   * - Results include public user info via Unit relation
   */
  async getCommentTreeFlat(
    rootUnitId: string,
    options: {
      parentId?: string;
      maxDepth?: number;
      start?: number;
      limit?: number;
      order?: 'asc' | 'desc';
    } = {},
  ): Promise<CommentTreeNode[]> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 50), 200));
    const skipNum = options.start ?? 0;
    const order = options.order ?? 'asc';

    const where: Prisma.CommentIndexWhereInput = {rootUnitId};

    if (options.parentId) {
      // Only direct children of the given parent
      where.parentCommentId = options.parentId;
    } else if (typeof options.maxDepth === 'number') {
      // Depth from root (0 = direct reply to root object)
      where.depth = {lte: options.maxDepth};
    }

    const items = await prisma.commentIndex.findMany({
      where,
      orderBy: [{unit: {createdAt: order}}],
      skip: skipNum,
      take: limitNum,
      include: {unit: {include: {user: true}}},
    });

    return items.map(ci => ({
      id: ci.unitId,
      rootUnitId: ci.rootUnitId,
      parentCommentId: ci.parentCommentId ?? undefined,
      depth: ci.depth,
      content: ci.unit?.content ?? undefined,
      createdAt: ci.unit?.createdAt,
      user: ci.unit?.user
        ? {
            id: ci.unit.user.unitId,
            slug: ci.unit.user.slug ?? undefined,
            name: ci.unit.user.name,
            avatar: ci.unit.user.avatar ?? (null as any),
            bio: ci.unit.user.bio ?? undefined,
          }
        : undefined,
    }));
  }
}

export const unitService = new UnitService();
