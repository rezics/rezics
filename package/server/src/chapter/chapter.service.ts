import type {
  ChapterMaterializationRequest,
  ChapterMaterializationResponse,
  ChapterListQuery,
  CreateChapterInput,
  UpdateChapterInput,
} from "@rezics/contract";
import {
  getBookIndexNode,
  normalizeBookIndexValue,
  updateBookIndexNode,
} from "@/book/book-index";
import { parseIdsCsv, withCoverUrl } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import {
  type ContentRating,
  PostKind,
  prisma,
  UnitStatus,
  UnitType,
} from "#/prisma/client";
import type { ChapterPostWithRelations } from "./types";
import { chapterPostInclude } from "./types";

/**
 * Thin wrapper over Post(kind=CHAPTER) — see chapter-as-post-and-cover-relocation.
 *
 * Storage:
 *   - Chapter title       -> UnitTranslation.title
 *   - Chapter cover URL   -> UnitTranslation.extra.coverUrl (typed)
 *   - Chapter body        -> Post.body
 *   - Chapter parent book -> Post.targetUnitId (must reference Unit(type=BOOK))
 *   - Chapter ordering    -> BookIndex.index (out of scope of this service)
 */
export class ChapterService {
  private buildWhereClause(options: ChapterListQuery): Prisma.PostWhereInput {
    const andWhere: Prisma.PostWhereInput[] = [{ kind: PostKind.CHAPTER }];

    // Search title via Unit.translations (and body)
    if (options.q?.trim()) {
      andWhere.push({
        OR: [
          {
            unit: {
              translations: {
                some: { title: { contains: options.q, mode: "insensitive" } },
              },
            },
          },
          { body: { contains: options.q, mode: "insensitive" } },
        ],
      });
    }

    // Filter by chapter author
    if (options.userId?.trim()) {
      andWhere.push({ authorUserId: options.userId });
    }

    // Filter by Unit.status (CSV allowed)
    const statuses = (options.status ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean) as (keyof typeof UnitStatus)[];
    if (statuses.length > 0) {
      andWhere.push({
        unit: { status: { in: statuses as unknown as UnitStatus[] } },
      });
    }

    // Filter by parent book (targetUnitId). CSV allowed.
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

    // Intersect with explicit unit id list (from listGetQueryBase)
    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      andWhere.push({ unitId: { in: idList } });
    }

    return { AND: andWhere };
  }

  async list(options: ChapterListQuery = {}): Promise<{
    items: ChapterPostWithRelations[];
    total: number;
  }> {
    const cursor = options.cursor;
    const hasCursor = cursor?.unitId && cursor?.createdAt;
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skipNum = hasCursor ? 1 : (options.start ?? 0);
    const where = this.buildWhereClause(options);

    const sortType =
      options.sort?.type === "updatedAt" ? "updatedAt" : "createdAt";
    const sortOrder = options.sort?.order === "asc" ? "asc" : "desc";

    const [items, total] = await Promise.all([
      prisma.post.findMany({
        where,
        orderBy: { [sortType]: sortOrder },
        skip: skipNum,
        cursor: hasCursor ? { unitId: cursor!.unitId! } : undefined,
        take: limitNum,
        include: chapterPostInclude,
      }),
      prisma.post.count({ where }),
    ]);

    return { items, total };
  }

  async getByUnitId(unitId: string): Promise<ChapterPostWithRelations> {
    return prisma.post.findUniqueOrThrow({
      where: { unitId },
      include: chapterPostInclude,
    });
  }

  async create(req: CreateChapterInput): Promise<ChapterPostWithRelations> {
    const { userId, title, content, targetUnitId, coverUrl, status, rating } =
      req;

    const target = await prisma.unit.findUnique({
      where: { id: targetUnitId },
      select: { id: true, type: true, defaultLanguage: true },
    });
    if (!target || target.type !== UnitType.BOOK) {
      throw new Error(
        `Chapter targetUnitId must reference a Unit(type=BOOK); got ${target?.type ?? "missing"}`,
      );
    }

    const language = target.defaultLanguage ?? "en";
    const extraJson =
      coverUrl !== undefined
        ? (withCoverUrl(undefined, coverUrl) as Prisma.InputJsonValue)
        : undefined;

    return prisma.$transaction(async (tx) => {
      const unit = await tx.unit.create({
        data: {
          userId,
          type: UnitType.POST,
          status: (status as UnitStatus) || UnitStatus.PUBLISHED,
          defaultLanguage: language,
          rating: (rating as ContentRating | undefined) ?? undefined,
          translations: {
            create: {
              language,
              title,
              extra: extraJson,
            },
          },
        },
      });

      await tx.post.create({
        data: {
          unitId: unit.id,
          authorUserId: userId,
          targetUnitId,
          kind: PostKind.CHAPTER,
          body: content ?? "",
          rootPostUnitId: unit.id,
          depth: 0,
        },
      });

      return tx.post.findUniqueOrThrow({
        where: { unitId: unit.id },
        include: chapterPostInclude,
      });
    });
  }

  async materializeByBookPath(
    bookUnitId: string,
    req: ChapterMaterializationRequest,
    userId: string,
  ): Promise<ChapterMaterializationResponse> {
    return prisma.$transaction(async (tx) => {
      const book = await tx.unit.findUnique({
        where: { id: bookUnitId },
        select: { id: true, type: true, defaultLanguage: true },
      });
      if (!book || book.type !== UnitType.BOOK) {
        throw new Error(`bookUnitId must reference a Unit(type=BOOK)`);
      }

      await tx.$queryRaw`
        SELECT "bookUnitId"
        FROM "BookIndex"
        WHERE "bookUnitId" = ${bookUnitId}
        FOR UPDATE
      `;

      const bookIndex = await tx.bookIndex.findUniqueOrThrow({
        where: { bookUnitId },
      });

      if (
        req.expectedBookIndexUpdatedAt &&
        new Date(req.expectedBookIndexUpdatedAt).getTime() !==
          new Date(bookIndex.updatedAt).getTime()
      ) {
        throw new Error("Conflict: BookIndex has changed");
      }

      const index = normalizeBookIndexValue(bookIndex.index);
      const node = getBookIndexNode(index, req.path);
      if (!node) {
        throw new Error("Conflict: BookIndex path does not resolve");
      }
      if (req.expectedTitle && node.title !== req.expectedTitle) {
        throw new Error("Conflict: BookIndex path no longer matches title");
      }

      if (node.chapterUnitId) {
        return {
          bookUnitId,
          path: req.path,
          chapterUnitId: node.chapterUnitId,
          alreadyMaterialized: true,
          bookIndexUpdatedAt: bookIndex.updatedAt,
        };
      }

      const language = book.defaultLanguage ?? "en";
      const unit = await tx.unit.create({
        data: {
          userId,
          type: UnitType.POST,
          status: UnitStatus.PUBLISHED,
          defaultLanguage: language,
          rating: (node.rating as ContentRating | undefined) ?? undefined,
          translations: {
            create: {
              language,
              title: node.title,
            },
          },
        },
      });

      await tx.post.create({
        data: {
          unitId: unit.id,
          authorUserId: userId,
          targetUnitId: bookUnitId,
          kind: PostKind.CHAPTER,
          body: "",
          rootPostUnitId: unit.id,
          depth: 0,
        },
      });

      const updatedIndex = updateBookIndexNode(index, req.path, (current) => ({
        ...current,
        chapterUnitId: unit.id,
      }));

      const updatedBookIndex = await tx.bookIndex.update({
        where: { bookUnitId },
        data: { index: updatedIndex as Prisma.InputJsonValue },
      });

      return {
        bookUnitId,
        path: req.path,
        chapterUnitId: unit.id,
        alreadyMaterialized: false,
        bookIndexUpdatedAt: updatedBookIndex.updatedAt,
      };
    });
  }

  async update(
    unitId: string,
    req: UpdateChapterInput,
  ): Promise<ChapterPostWithRelations> {
    const { title, content, targetUnitId, coverUrl, status, rating } = req;

    if (targetUnitId !== undefined && targetUnitId !== null) {
      const target = await prisma.unit.findUnique({
        where: { id: targetUnitId },
        select: { type: true },
      });
      if (!target || target.type !== UnitType.BOOK) {
        throw new Error(
          `Chapter targetUnitId must reference a Unit(type=BOOK); got ${target?.type ?? "missing"}`,
        );
      }
    }

    return prisma.$transaction(async (tx) => {
      const postPatch: Prisma.PostUpdateInput = {};
      if (content !== undefined) postPatch.body = content;
      if (targetUnitId !== undefined) {
        postPatch.targetUnit =
          targetUnitId === null
            ? { disconnect: true }
            : { connect: { id: targetUnitId } };
      }
      if (Object.keys(postPatch).length > 0) {
        await tx.post.update({ where: { unitId }, data: postPatch });
      }

      if (status || rating !== undefined) {
        await tx.unit.update({
          where: { id: unitId },
          data: {
            ...(status ? { status: status as UnitStatus } : {}),
            ...(rating !== undefined
              ? { rating: rating as ContentRating }
              : {}),
          },
        });
      }

      if (title !== undefined || coverUrl !== undefined) {
        const existing = await tx.unitTranslation.findFirst({
          where: { unitId },
        });
        const language =
          existing?.language ??
          (
            await tx.unit.findUniqueOrThrow({
              where: { id: unitId },
              select: { defaultLanguage: true },
            })
          ).defaultLanguage ??
          "en";

        const nextExtra =
          coverUrl !== undefined
            ? (withCoverUrl(
                existing?.extra,
                coverUrl ?? undefined,
              ) as Prisma.InputJsonValue)
            : undefined;

        if (existing) {
          await tx.unitTranslation.update({
            where: { unitId_language: { unitId, language: existing.language } },
            data: {
              ...(title !== undefined ? { title } : {}),
              ...(nextExtra !== undefined ? { extra: nextExtra } : {}),
            },
          });
        } else {
          await tx.unitTranslation.create({
            data: {
              unitId,
              language,
              title: title ?? "",
              extra: nextExtra,
            },
          });
        }
      }

      return tx.post.findUniqueOrThrow({
        where: { unitId },
        include: chapterPostInclude,
      });
    });
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }

  async exists(unitId: string): Promise<boolean> {
    const count = await prisma.post.count({
      where: { unitId, kind: PostKind.CHAPTER },
    });
    return count > 0;
  }
}

export const chapterService = new ChapterService();
