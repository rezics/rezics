import type {
  ChapterListQuery,
  CreateChapterInput,
  UpdateChapterInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import type { ChapterUnitWithRelations } from "./types";
import { chapterUnitInclude } from "./types";

export class ChapterService {
  private buildWhereClause(options: ChapterListQuery): Prisma.UnitWhereInput {
    const andWhere: Prisma.UnitWhereInput[] = [];

    // Search in title/content
    if (options.q?.trim()) {
      andWhere.push({
        OR: [
          { title: { contains: options.q, mode: "insensitive" } },
          { content: { contains: options.q } },
        ],
      });
    }

    // Filter by user ID
    if (options.userId?.trim()) {
      andWhere.push({ userId: options.userId });
    }

    // Filter by tags (CSV or single)
    const tagList = (options.tags ?? options.tag ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      andWhere.push({ tags: { some: { name: { in: tagList } } } });
    }

    // Filter by status (CSV allowed)
    const statuses = (options.status ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as (keyof typeof UnitStatus)[];
    if (statuses.length > 0) {
      andWhere.push({ status: { in: statuses as unknown as UnitStatus[] } });
    }

    // Filter by target unit (book or chapter). Allow CSV
    const targetList = (options.targetUnitIds ?? options.targetUnitId ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (targetList.length > 0) {
      andWhere.push({ targetUnitId: { in: targetList } });
    }

    // Date range
    if (options.createdAtFrom || options.createdAtTo) {
      andWhere.push({
        createdAt: {
          gte: options.createdAtFrom
            ? new Date(options.createdAtFrom)
            : undefined,
          lte: options.createdAtTo ? new Date(options.createdAtTo) : undefined,
        },
      });
    }

    // Always restrict to CHAPTER
    andWhere.push({ type: UnitType.CHAPTER });

    return andWhere.length > 0 ? { AND: andWhere } : { type: UnitType.CHAPTER };
  }

  async list(options: ChapterListQuery = {}): Promise<{
    items: ChapterUnitWithRelations[];
    total: number;
  }> {
    const cursor = options.cursor;
    const hasCursor = cursor?.unitId && cursor?.createdAt;
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const calculateSkip = () => (hasCursor ? 1 : (options.start ?? 0));
    const skipNum = calculateSkip();
    const where = this.buildWhereClause(options);

    const sortType =
      options.sort?.type === "updatedAt" ? "updatedAt" : "createdAt";
    const sortOrder = options.sort?.order === "asc" ? "asc" : "desc";

    const [items, total] = await Promise.all([
      prisma.unit.findMany({
        where,
        orderBy: { [sortType]: sortOrder },
        skip: skipNum,
        cursor: hasCursor ? { id: cursor!.unitId! } : undefined,
        take: limitNum,
        include: chapterUnitInclude,
      }),
      prisma.unit.count({ where }),
    ]);

    return { items: items as ChapterUnitWithRelations[], total };
  }

  async getByUnitId(unitId: string): Promise<ChapterUnitWithRelations> {
    const unit = await prisma.unit.findUniqueOrThrow({
      where: { id: unitId },
      include: chapterUnitInclude,
    });
    return unit as ChapterUnitWithRelations;
  }

  async create(req: CreateChapterInput): Promise<ChapterUnitWithRelations> {
    const { userId, title, content, targetUnitId, metadata, status } = req;
    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.CHAPTER,
        status: (status as UnitStatus) || UnitStatus.PUBLISHED,
        title,
        content: content || undefined,
        targetUnitId: targetUnitId || undefined,
        metadata: (metadata ?? {}) as Prisma.InputJsonValue,
      },
      include: chapterUnitInclude,
    });
    return unit as ChapterUnitWithRelations;
  }

  async update(
    unitId: string,
    req: UpdateChapterInput,
  ): Promise<ChapterUnitWithRelations> {
    const { title, content, targetUnitId, metadata, status } = req;
    const unit = await prisma.unit.update({
      where: { id: unitId },
      data: {
        title: title || undefined,
        content: content ?? undefined,
        targetUnitId: targetUnitId === null ? null : targetUnitId || undefined,
        metadata: (metadata ?? undefined) as Prisma.InputJsonValue | undefined,
        status: (status as UnitStatus) || undefined,
      },
      include: chapterUnitInclude,
    });
    return unit as ChapterUnitWithRelations;
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }

  async exists(unitId: string): Promise<boolean> {
    const count = await prisma.unit.count({
      where: { id: unitId, type: UnitType.CHAPTER },
    });
    return count > 0;
  }
}

export const chapterService = new ChapterService();
