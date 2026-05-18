import type {
  BookContentStructureResponse,
  BookListQuery,
  BookContentStructureItem,
  CreateBookInput,
  UpdateBookInput,
} from "@rezics/contract";
import { parseIdsCsv, withCoverUrl } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import {
  type ContentRating,
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
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import { assertLicenseSlug } from "@/unit/publication-policy";
import {
  buildTree,
  countReadableBookContentStructureItems,
} from "./book-content-structure";
import { between, firstKey } from "./lexorank";
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

    // Rating filter — if specified, narrow by single rating value.
    if (options.rating) {
      andWhere.push({ unit: { rating: options.rating as ContentRating } });
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

    // Filter by entity ID (via credit attribution)
    if (options.entityId?.trim()) {
      andWhere.push({
        unit: {
          creditAttributions: {
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
      prisma.book.count({ where }),
    ]);

    return {
      books: await hydrateUnitOwnerUserSlugs(books as BookWithRelations[]),
      total,
    };
  }

  /**
   * Get book by unitId
   */
  async getByUnitId(unitId: string): Promise<BookWithRelations> {
    const book = await prisma.book.findUniqueOrThrow({
      where: { unitId },
      include: bookInclude,
    });

    return hydrateUnitOwnerUserSlugRow(book as BookWithRelations);
  }

  /**
   * Get content structure by bookUnitId. Reads all node rows for the book and
   * assembles them server-side into the nested `BookContentStructureItem[]` wire shape.
   */
  async getContentStructureByBookUnitId(
    bookUnitId: string,
  ): Promise<BookContentStructureResponse> {
    const [container, nodeRows] = await Promise.all([
      prisma.bookContentStructure.findUniqueOrThrow({
        where: { bookUnitId },
        select: { bookUnitId: true, createdAt: true, updatedAt: true },
      }),
      prisma.bookContentStructureNode.findMany({
        where: { bookUnitId },
        orderBy: [{ parentId: "asc" }, { sortKey: "asc" }],
      }),
    ]);
    const nodes = buildTree(nodeRows);
    return {
      bookUnitId: container.bookUnitId,
      nodes,
      createdAt: container.createdAt,
      updatedAt: container.updatedAt,
    };
  }

  /**
   * Get book by ISBN13
   */
  async getByIsbn13(isbn13: string): Promise<BookWithRelations | null> {
    const book = await prisma.book.findFirst({
      where: { isbn13 },
      include: bookInclude,
    });

    return book ? hydrateUnitOwnerUserSlugRow(book as BookWithRelations) : null;
  }

  /**
   * Create new book (Unit + Book extension + translations in one transaction)
   */
  async create(req: CreateBookInput): Promise<BookWithRelations> {
    const language = req.defaultLanguage ?? "en";
    const providedTranslations = req.translations ?? [];
    const hasDefault = providedTranslations.some(
      (tr) => tr.language === language,
    );
    const ensuredTranslations = hasDefault
      ? providedTranslations
      : req.coverUrl !== undefined
        ? [...providedTranslations, { language }]
        : providedTranslations;

    const translationData = ensuredTranslations.map((tr) => {
      const baseExtra = (tr.extra ?? undefined) as
        | Record<string, unknown>
        | undefined;
      const nextExtra =
        req.coverUrl !== undefined && tr.language === language
          ? withCoverUrl(baseExtra, req.coverUrl ?? undefined)
          : baseExtra;
      return {
        language: tr.language,
        title: tr.title ?? undefined,
        subtitle: tr.subtitle ?? undefined,
        summary: tr.summary ?? undefined,
        description: tr.description ?? undefined,
        extra: (nextExtra ?? null) as Prisma.InputJsonValue,
        sourceReleaseUnitId: tr.sourceReleaseUnitId ?? undefined,
      };
    });

    const book = await prisma.book.create({
      data: {
        unit: {
          create: {
            userId: req.userId || "",
            slugScope: req.userId || "",
            type: UnitType.BOOK,
            status: UnitStatus.PUBLISHED,
            visibility: (req.visibility as UnitVisibility) ?? undefined,
            licenseSlug: assertLicenseSlug(req.licenseSlug) ?? undefined,
            copyrightNotice: req.copyrightNotice ?? undefined,
            workUnitId: req.workUnitId ?? undefined,
            defaultLanguage: req.defaultLanguage ?? undefined,
            rating: (req.rating as ContentRating | undefined) ?? undefined,
            extra: undefined,
            translations: translationData.length
              ? { create: translationData }
              : undefined,
          },
        },
        isbn13: req.isbn13 ?? undefined,
        publicationDate: req.publicationDate
          ? new Date(req.publicationDate as any)
          : undefined,
        pageCount: req.pageCount ?? undefined,
        textLength: req.textLength ?? 0,
        chapterCount: 0,
        formatKey: req.formatKey ?? undefined,
        isLicensed: req.isLicensed ?? false,
        extra: (req.extra ?? null) as Prisma.InputJsonValue,
        contentStructure: {
          create: {},
        },
      },
      include: bookInclude,
    });

    await syncContentToMeili(book.unitId);

    return hydrateUnitOwnerUserSlugRow(book as BookWithRelations);
  }

  /**
   * Update book
   */
  async update(
    unitId: string,
    req: UpdateBookInput,
  ): Promise<BookWithRelations> {
    if (req.coverUrl !== undefined) {
      const unit = await prisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { defaultLanguage: true },
      });
      const language = unit.defaultLanguage ?? "en";
      const existing = await prisma.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language } },
        select: { extra: true },
      });
      const nextExtra = withCoverUrl(
        existing?.extra ?? undefined,
        req.coverUrl ?? undefined,
      ) as Prisma.InputJsonValue;
      await prisma.unitTranslation.upsert({
        where: { unitId_language: { unitId, language } },
        create: { unitId, language, extra: nextExtra },
        update: { extra: nextExtra },
      });
    }

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
        extra: (req.extra ?? undefined) as Prisma.InputJsonValue | undefined,
        unit: {
          update: {
            rating: (req.rating as ContentRating | undefined) ?? undefined,
            visibility:
              (req.visibility as UnitVisibility | undefined) ?? undefined,
            licenseSlug:
              req.licenseSlug === null
                ? null
                : (assertLicenseSlug(req.licenseSlug) ?? undefined),
            copyrightNotice:
              req.copyrightNotice === null
                ? null
                : (req.copyrightNotice ?? undefined),
          },
        },
      },
      include: bookInclude,
    });

    const patchFields: Record<string, any> = {};
    if (req.isLicensed !== undefined) patchFields.isLicensed = req.isLicensed;
    if (req.coverUrl !== undefined) patchFields.coverUrl = req.coverUrl;
    if (req.rating !== undefined) patchFields.rating = req.rating;
    if (req.visibility !== undefined) patchFields.visibility = req.visibility;
    if (req.licenseSlug !== undefined)
      patchFields.licenseSlug = req.licenseSlug;
    if (req.copyrightNotice !== undefined)
      patchFields.copyrightNotice = req.copyrightNotice;
    await patchContentMetadataToMeili(unitId, patchFields);

    return hydrateUnitOwnerUserSlugRow(book as BookWithRelations);
  }

  /**
   * Update content structure (diff-based TOC save).
   *
   * Walks the submitted tree, diffs against current BookContentStructureNode
   * rows, and applies the minimum set of INSERT / UPDATE / DELETE in a single
   * transaction. Preserves existing `sortKey` values when sibling order is
   * unchanged so a no-op save produces zero row mutations. The container
   * `updatedAt` is bumped only when at least one node actually changed.
   */
  async updateContentStructure(
    unitId: string,
    submitted: BookContentStructureItem[],
  ): Promise<BookContentStructureResponse> {
    await prisma.$transaction(async (tx) => {
      const current = await tx.bookContentStructureNode.findMany({
        where: { bookUnitId: unitId },
        select: {
          id: true,
          parentId: true,
          sortKey: true,
          chapterUnitId: true,
          title: true,
          noContent: true,
          rating: true,
        },
      });

      const currentById = new Map(current.map((row) => [row.id, row]));
      const planned = planSubmittedTree(submitted, currentById);
      const submittedIds = new Set(planned.map((p) => p.id));
      const chapterCount = countReadableBookContentStructureItems(submitted);

      let mutated = false;

      const toDelete = current
        .map((row) => row.id)
        .filter((id) => !submittedIds.has(id));
      if (toDelete.length > 0) {
        await tx.bookContentStructureNode.deleteMany({
          where: { id: { in: toDelete } },
        });
        mutated = true;
      }

      for (const plan of planned) {
        const existing = currentById.get(plan.id);
        if (!existing) {
          await tx.bookContentStructureNode.create({
            data: {
              id: plan.id,
              bookUnitId: unitId,
              parentId: plan.parentId,
              sortKey: plan.sortKey,
              chapterUnitId: plan.chapterUnitId ?? null,
              title: plan.title,
              noContent: plan.noContent,
              rating: plan.rating ?? null,
            },
          });
          mutated = true;
          continue;
        }

        if (
          existing.parentId !== plan.parentId ||
          existing.sortKey !== plan.sortKey ||
          (existing.chapterUnitId ?? null) !== (plan.chapterUnitId ?? null) ||
          existing.title !== plan.title ||
          existing.noContent !== plan.noContent ||
          (existing.rating ?? null) !== (plan.rating ?? null)
        ) {
          await tx.bookContentStructureNode.update({
            where: { id: plan.id },
            data: {
              parentId: plan.parentId,
              sortKey: plan.sortKey,
              chapterUnitId: plan.chapterUnitId ?? null,
              title: plan.title,
              noContent: plan.noContent,
              rating: plan.rating ?? null,
            },
          });
          mutated = true;
        }
      }

      if (mutated) {
        await tx.bookContentStructure.update({
          where: { bookUnitId: unitId },
          data: { updatedAt: new Date() },
        });
        await tx.book.update({
          where: { unitId },
          data: { chapterCount },
        });
      }
    });

    return this.getContentStructureByBookUnitId(unitId);
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

// ---------------------------------------------------------------------------
// TOC save planning
// ---------------------------------------------------------------------------

interface PlannedNode {
  id: string;
  parentId: string | null;
  sortKey: string;
  title: string;
  noContent: boolean;
  rating: ContentRating | null;
  chapterUnitId: string | null;
}

interface ExistingRow {
  id: string;
  parentId: string | null;
  sortKey: string;
  chapterUnitId: string | null;
  title: string;
  noContent: boolean;
  rating: ContentRating | null;
}

/**
 * Walk the submitted tree DFS, assigning ids to nodes without one and
 * allocating `sortKey` values that preserve existing rows' keys when sibling
 * ordering hasn't changed. Returns a flat list of planned rows.
 *
 * A child's `parentId` is its in-tree parent id (the id we just assigned for
 * the parent), regardless of any client-supplied `parentId` — this guards
 * against cycles or malformed submissions.
 */
function planSubmittedTree(
  submitted: readonly BookContentStructureItem[],
  existingById: ReadonlyMap<string, ExistingRow>,
): PlannedNode[] {
  const out: PlannedNode[] = [];
  // Track id reuse to avoid two submitted nodes claiming the same row.
  const claimedIds = new Set<string>();

  function visit(
    siblings: readonly BookContentStructureItem[],
    parentId: string | null,
  ): void {
    const ids: string[] = siblings.map((node) => {
      const claimed = node.id && !claimedIds.has(node.id) ? node.id : undefined;
      const fresh =
        claimed && existingById.has(claimed)
          ? claimed
          : (claimed ?? generateNodeId());
      claimedIds.add(fresh);
      return fresh;
    });

    const sortKeys = allocateSortKeys(siblings, ids, parentId, existingById);

    for (let i = 0; i < siblings.length; i++) {
      const node = siblings[i]!;
      const id = ids[i]!;
      const sortKey = sortKeys[i]!;
      out.push({
        id,
        parentId,
        sortKey,
        title: node.title,
        noContent: node.noContent === true,
        rating: (node.rating as ContentRating | undefined) ?? null,
        chapterUnitId: node.chapterUnitId ?? null,
      });
      if (node.children && node.children.length > 0) {
        visit(node.children, id);
      }
    }
  }

  visit(submitted, null);
  return out;
}

function allocateSortKeys(
  siblings: readonly BookContentStructureItem[],
  assignedIds: readonly string[],
  parentId: string | null,
  existingById: ReadonlyMap<string, ExistingRow>,
): string[] {
  const existingKeys: (string | null)[] = assignedIds.map((id, i) => {
    const node = siblings[i]!;
    if (!node.id) return null;
    const existing = existingById.get(id);
    if (!existing || existing.parentId !== parentId) return null;
    return existing.sortKey;
  });

  const result: string[] = [];
  for (let i = 0; i < siblings.length; i++) {
    const prev = result[i - 1] ?? null;
    const candidate = existingKeys[i] ?? null;

    if (candidate !== null && (prev === null || candidate > prev)) {
      result.push(candidate);
      continue;
    }

    let upper: string | null = null;
    for (let j = i + 1; j < siblings.length; j++) {
      const e = existingKeys[j] ?? null;
      if (e !== null && (prev === null || e > prev)) {
        upper = e;
        break;
      }
    }
    const fresh =
      prev === null && upper === null ? firstKey() : between(prev, upper);
    result.push(fresh);
  }
  return result;
}

function generateNodeId(): string {
  return crypto.randomUUID();
}
