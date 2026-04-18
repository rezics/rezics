import type {
  ChapterListQuery,
  CreateChapterInput,
  UpdateChapterInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import type { ChapterUnitWithRelations } from "./types";
import { chapterUnitInclude } from "./types";

export class ChapterService {
  private buildWhereClause(options: ChapterListQuery): Prisma.UnitWhereInput {
    const andWhere: Prisma.UnitWhereInput[] = [];

    // Search in title via translations
    if (options.q?.trim()) {
      andWhere.push({
        translations: {
          some: {
            OR: [
              { title: { contains: options.q, mode: "insensitive" } },
              { description: { contains: options.q } },
            ],
          },
        },
      });
    }

    // Filter by user ID
    if (options.userId?.trim()) {
      andWhere.push({ userId: options.userId });
    }

    // Filter by status (CSV allowed)
    const statuses = (options.status ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean) as (keyof typeof UnitStatus)[];
    if (statuses.length > 0) {
      andWhere.push({ status: { in: statuses as unknown as UnitStatus[] } });
    }

    // Filter by target unit (book). Allow CSV
    const targetList = (options.targetUnitIds ?? options.targetUnitId ?? "")
      .split(",")
      .map((s: string) => s.trim())
      .filter(Boolean);
    if (targetList.length > 0) {
      andWhere.push({ workUnitId: { in: targetList } });
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

    // Intersect with explicit unit id list (from listGetQueryBase)
    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      andWhere.push({ id: { in: idList } });
    }

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

    return { items, total };
  }

  async getByUnitId(unitId: string): Promise<ChapterUnitWithRelations> {
    return prisma.unit.findUniqueOrThrow({
      where: { id: unitId },
      include: chapterUnitInclude,
    });
  }

  async create(req: CreateChapterInput): Promise<ChapterUnitWithRelations> {
    const { userId, title, content, targetUnitId, status } = req;
    return prisma.unit.create({
      data: {
        userId,
        type: UnitType.CHAPTER,
        status: (status as UnitStatus) || UnitStatus.PUBLISHED,
        workUnitId: targetUnitId || undefined,
        translations: {
          create: {
            language: "en",
            title,
            description: content || undefined,
          },
        },
      },
      include: chapterUnitInclude,
    });
  }

  async update(
    unitId: string,
    req: UpdateChapterInput,
  ): Promise<ChapterUnitWithRelations> {
    const { title, content, targetUnitId, status } = req;

    // Update the unit base fields
    const unitData: Prisma.UnitUpdateInput = {};
    if (targetUnitId !== undefined) {
      unitData.work =
        targetUnitId === null
          ? { disconnect: true }
          : { connect: { id: targetUnitId } };
    }
    if (status) {
      unitData.status = status as UnitStatus;
    }

    // Update the translation if title or content changed
    if (title !== undefined || content !== undefined) {
      const existing = await prisma.unitTranslation.findFirst({
        where: { unitId },
      });
      if (existing) {
        await prisma.unitTranslation.update({
          where: { unitId_language: { unitId, language: existing.language } },
          data: {
            ...(title !== undefined ? { title } : {}),
            ...(content !== undefined ? { description: content } : {}),
          },
        });
      } else {
        await prisma.unitTranslation.create({
          data: {
            unitId,
            language: "en",
            title: title ?? "",
            description: content ?? undefined,
          },
        });
      }
    }

    return prisma.unit.update({
      where: { id: unitId },
      data: unitData,
      include: chapterUnitInclude,
    });
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
