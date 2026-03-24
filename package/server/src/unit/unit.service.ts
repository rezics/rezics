import {prisma} from '#/prisma/client';
import type {Prisma} from '#/prisma/client';
import {UnitStatus, UnitType} from '#/prisma/client';
import type {
  UnitListQuery,
  CreateUnitInput,
  UpdateUnitInput,
} from '@package/contract';
import {unitInclude} from './types';
import type {UnitWithRelations} from './types';
import {syncUnitToMeili, deleteUnitFromMeili} from '@/meili/unit/sync';

type MaybeInclude = Prisma.UnitInclude | undefined;
type ResolvedInclude<TInclude extends MaybeInclude> =
  TInclude extends Prisma.UnitInclude ? TInclude : typeof unitInclude;
type UnitResult<TInclude extends MaybeInclude> = Prisma.UnitGetPayload<{
  include: ResolvedInclude<TInclude>;
}>;

/**
 * Compose a Prisma where clause for Unit list queries.
 */
export function buildUnitWhereClause(
  options: UnitListQuery,
): Prisma.UnitWhereInput {
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
  if (typeList.length > 0) andWhere.push({type: {in: typeList as UnitType[]}});

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
      domains: {some: {id: {in: domainList}}},
    });
  }

  // Target filters
  const targetList = (options.targetUnitIds ?? '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
  const singleTarget = options.targetUnitId?.trim();
  const combinedTargets = [...targetList, singleTarget].filter(
    Boolean,
  ) as string[];
  if (combinedTargets.length === 1)
    andWhere.push({targetUnitId: combinedTargets[0]});
  if (combinedTargets.length > 1)
    andWhere.push({targetUnitId: {in: Array.from(new Set(combinedTargets))}});
  if (options.hasTarget === 'true') andWhere.push({NOT: {targetUnitId: null}});
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
 * Merge multiple where inputs with AND semantics.
 */
export function mergeUnitWhereInputs(
  ...clauses: (Prisma.UnitWhereInput | undefined)[]
): Prisma.UnitWhereInput {
  const valid = clauses.filter(Boolean) as Prisma.UnitWhereInput[];
  if (valid.length === 0) return {};
  if (valid.length === 1) return valid[0]!;
  return {AND: valid};
}

/**
 * Unit Service - Business logic for generic Unit entities and comment trees
 */
export class UnitService {
  /**
   * List Units with pagination and rich filters
   */
  async list<TInclude extends MaybeInclude = undefined>(
    options: UnitListQuery = {},
    opts?: {
      include?: TInclude;
      where?: Prisma.UnitWhereInput;
    },
  ): Promise<{units: UnitResult<TInclude>[]; total: number}> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skipNum = options.cursor?.unitId ? 1 : options.start ?? 0;

    const include = (opts?.include ?? unitInclude) as ResolvedInclude<TInclude>;
    const baseWhere = buildUnitWhereClause(options);
    const where = mergeUnitWhereInputs(baseWhere, opts?.where);

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
        include: include as Prisma.UnitInclude,
      }),
      prisma.unit.count({where}),
    ]);

    return {
      units: units as UnitResult<TInclude>[],
      total,
    };
  }

  /** Get a unit by id with relations */
  async getByUnitId<TInclude extends MaybeInclude = undefined>(
    unitId: string,
    opts?: {include?: TInclude},
  ): Promise<UnitResult<TInclude>> {
    const include = (opts?.include ?? unitInclude) as ResolvedInclude<TInclude>;
    const unit = await prisma.unit.findUniqueOrThrow({
      where: {id: unitId},
      include: include as Prisma.UnitInclude,
    });
    return unit as UnitResult<TInclude>;
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
    await syncUnitToMeili(unit.id);
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
    await syncUnitToMeili(unitId);
    return unit as UnitWithRelations;
  }

  /** Delete a Unit by id (cascades) */
  async delete(
    unitId: string,
    db: Prisma.TransactionClient | typeof prisma = prisma,
  ): Promise<void> {
    await db.unit.delete({where: {id: unitId}});
    await deleteUnitFromMeili(unitId);
  }
}

export const unitService = new UnitService();
