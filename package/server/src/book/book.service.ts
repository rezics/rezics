import type {
  BookListQuery,
  CreateBookInput,
  UpdateBookInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import {
  prisma,
  UnitStatus,
  UnitType,
  type UnitVisibility,
} from "#/prisma/client";
import {
  deleteContentFromMeili,
  patchContentMetadataToMeili,
  syncContentToMeili,
} from "@/meili/content/sync";
import { getBookApproxCount } from "./sql";
import type { BookWithRelations } from "./types";
import { bookInclude } from "./types";

/**
 * Book Service - Business logic layer
 */
export class BookService {
  /**
   * Build where clause for book queries
   */
  private buildWhereClause(options: BookListQuery): Prisma.BookWhereInput {
    const andWhere: Prisma.BookWhereInput[] = [];

    // NSFW filter - by default, only return non-NSFW content
    if (options.nsfw === true) {
      andWhere.push({ unit: { nsfw: true } });
    } else {
      andWhere.push({ unit: { nsfw: false } });
    }

    // Filter by ISBN13
    if (options.isbn13?.trim()) {
      andWhere.push({
        isbn13: { contains: options.isbn13, mode: "insensitive" },
      });
    }

    // Filter by user ID (unit owner)
    if (options.userId?.trim()) {
      andWhere.push({ unit: { userId: options.userId } });
    }

    // Filter by entity ID (via Attribution)
    if (options.entityId?.trim()) {
      andWhere.push({
        unit: {
          attributions: {
            some: { entityId: options.entityId },
          },
        },
      });
    }

    // Filter by tag unit IDs (scored tags)
    const tagList = (options.tagUnitIds ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (tagList.length > 0) {
      andWhere.push({
        unit: {
          unitTags: {
            some: { tagUnitId: { in: tagList } },
          },
        },
      });
    }

    // Filter by language (translations must have this language)
    if (options.language?.trim()) {
      andWhere.push({
        unit: {
          translations: {
            some: { language: options.language },
          },
        },
      });
    }

    // Filter by workUnitId
    if (options.workUnitId?.trim()) {
      andWhere.push({ unit: { workUnitId: options.workUnitId } });
    }

    // Filter by visibility
    if (options.visibility?.trim()) {
      andWhere.push({
        unit: { visibility: options.visibility as UnitVisibility },
      });
    }

    // Filter by status
    if (options.status?.trim()) {
      andWhere.push({
        unit: { status: options.status as UnitStatus },
      });
    }

    // Intersect with explicit unit id list (from listGetQueryBase)
    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      andWhere.push({ unitId: { in: idList } });
    }

    return { AND: andWhere };
  }

  /**
   * List books with filters and pagination
   */
  async list(options: BookListQuery = {}): Promise<{
    books: BookWithRelations[];
    total: number;
  }> {
    const cursor = options.cursor;
    const hasCursor = cursor?.unitId && cursor?.createdAt;
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const skipNum = hasCursor ? 1 : (options.start ?? 0);
    const where = this.buildWhereClause(options);

    const sortField = options.sort?.type ?? "createdAt";
    const sortOrder = (
      options.sort?.order?.toLowerCase() === "asc" ? "asc" : "desc"
    ) as Prisma.SortOrder;

    const [books, total] = await Promise.all([
      prisma.book.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip: skipNum,
        cursor: hasCursor
          ? { unitId: cursor.unitId, createdAt: cursor.createdAt }
          : undefined,
        take: limitNum,
        include: bookInclude,
      }),
      getBookApproxCount(),
    ]);

    return { books: books as BookWithRelations[], total };
  }

  /**
   * Get book by unitId
   */
  async getByUnitId(unitId: string): Promise<BookWithRelations> {
    const book = await prisma.book.findUniqueOrThrow({
      where: { unitId },
      include: bookInclude,
    });

    return book as BookWithRelations;
  }

  /**
   * Get chapterIndex by bookUnitId
   */
  async getChapterIndexByBookUnitId(bookUnitId: string): Promise<any> {
    const chapterIndex = await prisma.bookIndex.findUniqueOrThrow({
      where: { bookUnitId },
    });
    return chapterIndex;
  }

  /**
   * Get book by ISBN13
   */
  async getByIsbn13(isbn13: string): Promise<BookWithRelations | null> {
    const book = await prisma.book.findFirst({
      where: { isbn13 },
      include: bookInclude,
    });

    return book as BookWithRelations | null;
  }

  /**
   * Create new book (Unit + Book extension + translations in one transaction)
   */
  async create(req: CreateBookInput): Promise<BookWithRelations> {
    const book = await prisma.book.create({
      data: {
        unit: {
          create: {
            userId: req.userId || "",
            type: UnitType.BOOK,
            status: UnitStatus.PUBLISHED,
            visibility: (req.visibility as UnitVisibility) ?? undefined,
            workUnitId: req.workUnitId ?? undefined,
            defaultLanguage: req.defaultLanguage ?? undefined,
            nsfw: req.nsfw ?? false,
            extra: undefined,
            translations:
              req.translations && req.translations.length > 0
                ? {
                    create: req.translations.map((tr) => ({
                      language: tr.language,
                      title: tr.title ?? undefined,
                      subtitle: tr.subtitle ?? undefined,
                      summary: tr.summary ?? undefined,
                      description: tr.description ?? undefined,
                      extra: (tr.extra ?? null) as Prisma.InputJsonValue,
                      sourceReleaseUnitId: tr.sourceReleaseUnitId ?? undefined,
                    })),
                  }
                : undefined,
          },
        },
        isbn13: req.isbn13 ?? undefined,
        publicationDate: req.publicationDate
          ? new Date(req.publicationDate as any)
          : undefined,
        pageCount: req.pageCount ?? undefined,
        textLength: req.textLength ?? 0,
        formatKey: req.formatKey ?? undefined,
        isLicensed: req.isLicensed ?? false,
        coverUrl: req.coverUrl ?? undefined,
        extra: (req.extra ?? null) as Prisma.InputJsonValue,
        chapterIndex: {
          create: { index: {} as Prisma.InputJsonValue },
        },
      },
      include: bookInclude,
    });

    await syncContentToMeili(book.unitId);

    return book as BookWithRelations;
  }

  /**
   * Update book
   */
  async update(
    unitId: string,
    req: UpdateBookInput,
  ): Promise<BookWithRelations> {
    const book = await prisma.book.update({
      where: { unitId },
      data: {
        isbn13: req.isbn13,
        publicationDate: req.publicationDate
          ? new Date(req.publicationDate as any)
          : req.publicationDate === null
            ? null
            : undefined,
        pageCount: req.pageCount,
        textLength: req.textLength ?? undefined,
        formatKey: req.formatKey,
        isLicensed: req.isLicensed ?? undefined,
        coverUrl: req.coverUrl,
        extra: (req.extra ?? undefined) as Prisma.InputJsonValue | undefined,
        unit: {
          update: {
            nsfw: req.nsfw ?? undefined,
            visibility:
              (req.visibility as UnitVisibility | undefined) ?? undefined,
          },
        },
      },
      include: bookInclude,
    });

    const patchFields: Record<string, any> = {};
    if (req.isLicensed !== undefined) patchFields.isLicensed = req.isLicensed;
    if (req.coverUrl !== undefined) patchFields.coverUrl = req.coverUrl;
    if (req.nsfw !== undefined) patchFields.nsfw = req.nsfw;
    if (req.visibility !== undefined) patchFields.visibility = req.visibility;
    await patchContentMetadataToMeili(unitId, patchFields);

    return book as BookWithRelations;
  }

  /**
   * Update chapter index
   */
  async updateChapterIndex(
    unitId: string,
    chaptersIndex: Prisma.InputJsonValue,
  ): Promise<Prisma.InputJsonValue> {
    const chapterIndex = await prisma.bookIndex.update({
      where: { bookUnitId: unitId },
      data: { index: chaptersIndex || undefined },
    });
    return chapterIndex;
  }

  /**
   * Delete book by unitId (cascades via Unit delete)
   */
  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
    await deleteContentFromMeili(unitId);
  }

  /**
   * Check if book exists by unitId
   */
  async exists(unitId: string): Promise<boolean> {
    const count = await prisma.book.count({ where: { unitId } });
    return count > 0;
  }
}

// Export singleton instance
export const bookService = new BookService();
