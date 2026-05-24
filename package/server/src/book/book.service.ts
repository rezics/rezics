import { HistoryOutboxPayloadKind } from "@rezics/contract";
import type {
  BookContentStructureResponse,
  BookListQuery,
  BookContentStructureItem,
  ContentStructureBatchOperation,
  CreateBookInput,
  EditorialPatchSubmission,
  RezicsSessionClaims,
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
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { serverJobProducer } from "@/job/job-boundary";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import { assertLicenseSlug } from "@/unit/publication-policy";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import {
  assertCanEditCollaborativeMetadata,
  hasOwn,
  mapActualTranslationPatchPaths,
  sameJson,
  translationPatchFromPaths,
  uniquePatchPaths,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import {
  buildStructureEventPayload,
  writeSequencedHistoryOutbox,
} from "@/unit/history-outbox";
import {
  buildTree,
  countReadableBookContentStructureItems,
} from "./book-content-structure";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { between, firstKey } from "./lexorank";
import type { BookWithRelations } from "./types";
import { bookInclude } from "./types";

function enqueueContentSync(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentSync,
      { unitId },
      { type: "server", service: "book" },
    ),
  );
}

function enqueueContentMetadata(
  unitId: string,
  fields: Record<string, unknown>,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchMetadata,
      { targetId: unitId, fields },
      { type: "server", service: "book" },
    ),
  );
}

function enqueueContentDelete(unitId: string) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentDelete,
      { unitId },
      { type: "server", service: "book" },
    ),
  );
}

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
    const actorUserId = req.userId || "";
    const ownerUserId =
      req.creationMode === "wiki"
        ? await resolveRezicsWikiUserId()
        : actorUserId;
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
        description: nullableContentDocJson(tr.description),
        extra: (nextExtra ?? null) as Prisma.InputJsonValue,
        sourceReleaseUnitId: tr.sourceReleaseUnitId ?? undefined,
      };
    });

    const book = await prisma.$transaction(async (tx) => {
      const created = await tx.book.create({
        data: {
          unit: {
            create: {
              userId: ownerUserId,
              slugScope: ownerUserId,
              type: UnitType.BOOK,
              status: UnitStatus.PUBLISHED,
              visibility: (req.visibility as UnitVisibility) ?? undefined,
              licenseSlug: assertLicenseSlug(req.licenseSlug) ?? undefined,
              workUnitId: req.workUnitId ?? undefined,
              defaultLanguage: req.defaultLanguage ?? undefined,
              rating: (req.rating as ContentRating | undefined) ?? undefined,
              extra: undefined,
              translations: translationData.length
                ? { create: translationData }
                : undefined,
              fieldLocks:
                req.creationMode === "wiki" || !actorUserId
                  ? undefined
                  : {
                      create: {
                        path: "*",
                        lockedById: actorUserId,
                        reason:
                          "Personal creation starts closed to community edits.",
                      },
                    },
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

      if (actorUserId) {
        await writeEditorialMetadataHistory(tx as any, {
          unitId: created.unitId,
          actorUserId,
          patch: buildBookCreatePatch(req, ensuredTranslations, language),
          message: "book.create",
        });
      }

      return created;
    });

    await enqueueContentSync(book.unitId);

    return hydrateUnitOwnerUserSlugRow(book as BookWithRelations);
  }

  /**
   * Update book
   */
  async update(
    unitId: string,
    req: UpdateBookInput,
    actor?: RezicsSessionClaims,
    historyInput?: Pick<
      EditorialPatchSubmission,
      "patch" | "message" | "restoreSource"
    >,
  ): Promise<BookWithRelations> {
    const book = await prisma.$transaction(async (tx) => {
      const current = await tx.book.findUniqueOrThrow({
        where: { unitId },
        select: {
          isbn13: true,
          publicationDate: true,
          pageCount: true,
          textLength: true,
          formatKey: true,
          isLicensed: true,
          extra: true,
          unit: {
            select: {
              defaultLanguage: true,
              rating: true,
              visibility: true,
              licenseSlug: true,
            },
          },
        },
      });
      const language = current.unit.defaultLanguage ?? "en";
      const existingCoverTranslation =
        req.coverUrl !== undefined
          ? await tx.unitTranslation.findUnique({
              where: { unitId_language: { unitId, language } },
              select: { extra: true },
            })
          : null;
      const patchPaths = mapBookEffectiveUpdatePatchPaths(
        req,
        current,
        existingCoverTranslation?.extra ?? null,
        language,
      );
      const patch = buildBookUpdatePatchFromPaths(req, patchPaths, language);

      if (patchPaths.length === 0) {
        return tx.book.findUniqueOrThrow({
          where: { unitId },
          include: bookInclude,
        });
      }

      if (actor) {
        await assertCanEditCollaborativeMetadata(
          tx as any,
          actor,
          unitId,
          patchPaths,
        );
      }

      if (req.coverUrl !== undefined) {
        const nextExtra = withCoverUrl(
          existingCoverTranslation?.extra ?? undefined,
          req.coverUrl ?? undefined,
        ) as Prisma.InputJsonValue;
        await tx.unitTranslation.upsert({
          where: { unitId_language: { unitId, language } },
          create: { unitId, language, extra: nextExtra },
          update: { extra: nextExtra },
        });
      }

      const updated = await tx.book.update({
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
            },
          },
        },
        include: bookInclude,
      });

      if (actor) {
        await writeEditorialMetadataHistory(tx as any, {
          unitId,
          actorUserId: actor.userId,
          patch: historyInput?.patch ?? patch,
          message: historyInput?.message ?? "book.metadata.update",
          restoreSource: historyInput?.restoreSource,
        });
      }

      return updated;
    });

    const patchFields: Record<string, any> = {};
    if (req.isLicensed !== undefined) patchFields.isLicensed = req.isLicensed;
    if (req.coverUrl !== undefined) patchFields.coverUrl = req.coverUrl;
    if (req.rating !== undefined) patchFields.rating = req.rating;
    if (req.visibility !== undefined) patchFields.visibility = req.visibility;
    if (req.licenseSlug !== undefined)
      patchFields.licenseSlug = req.licenseSlug;
    await enqueueContentMetadata(unitId, patchFields);

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
    options: { actorUserId?: string; message?: string | null } = {},
  ): Promise<BookContentStructureResponse> {
    await prisma.$transaction(async (tx) => {
      const actorUserId =
        options.actorUserId ?? (await resolveRezicsWikiUserId());
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
      const operations = planContentStructureOperations(current, planned);
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
        await writeSequencedHistoryOutbox(tx, {
          unitId,
          actorUserId,
          buildPayload: (sequence) => ({
            kind: HistoryOutboxPayloadKind.STRUCTURE_EVENT,
            event: buildStructureEventPayload({
              unitId,
              sequence,
              actorUserId,
              eventType: "book.contentStructure.batch",
              changedFieldKeys: ["book.contentStructure"],
              payload: { operations },
              message: options.message ?? null,
            }),
          }),
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
    await enqueueContentDelete(unitId);
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

export function buildBookCreatePatch(
  req: CreateBookInput,
  translations = req.translations ?? [],
  defaultLanguage = req.defaultLanguage ?? "en",
): Record<string, unknown> {
  const extension: Record<string, unknown> = {};
  if (req.isbn13 !== undefined) extension.isbn13 = req.isbn13;
  if (req.publicationDate !== undefined)
    extension.publicationDate = req.publicationDate;
  if (req.pageCount !== undefined) extension.pageCount = req.pageCount;
  if (req.textLength !== undefined) extension.textLength = req.textLength;
  if (req.formatKey !== undefined) extension.formatKey = req.formatKey;
  if (req.isLicensed !== undefined) extension.isLicensed = req.isLicensed;
  if (req.extra !== undefined) extension.extra = req.extra;

  const unit: Record<string, unknown> = {};
  if (req.rating !== undefined) unit.rating = req.rating;
  if (req.visibility !== undefined) unit.visibility = req.visibility;
  if (req.licenseSlug !== undefined) unit.license = req.licenseSlug;

  const translationPatch: Record<string, unknown> = {};
  for (const tr of translations) {
    const input = {
      title: tr.title,
      subtitle: tr.subtitle,
      summary: tr.summary,
      description: tr.description,
      extra:
        req.coverUrl !== undefined && tr.language === defaultLanguage
          ? {
              ...((tr.extra ?? undefined) as Record<string, unknown>),
              coverUrl: req.coverUrl ?? null,
            }
          : tr.extra,
      sourceReleaseUnitId: tr.sourceReleaseUnitId,
    };
    const paths = mapActualTranslationPatchPaths(input, null, tr.language);
    const patch = translationPatchFromPaths(tr.language, input, paths)
      .translations as Record<string, unknown>;
    if (patch[tr.language] !== undefined) {
      translationPatch[tr.language] = patch[tr.language];
    }
  }

  return {
    ...(Object.keys(extension).length > 0 ? { extension } : {}),
    ...(Object.keys(unit).length > 0 ? { unit } : {}),
    ...(Object.keys(translationPatch).length > 0
      ? { translations: translationPatch }
      : {}),
  };
}

export function mapBookUpdatePatchPaths(req: UpdateBookInput) {
  return uniquePatchPaths([
    req.isbn13 !== undefined ? "extension.isbn13" : undefined,
    req.publicationDate !== undefined ? "extension.publicationDate" : undefined,
    req.pageCount !== undefined ? "extension.pageCount" : undefined,
    req.textLength !== undefined ? "extension.textLength" : undefined,
    req.formatKey !== undefined ? "extension.formatKey" : undefined,
    req.isLicensed !== undefined ? "extension.isLicensed" : undefined,
    req.extra !== undefined ? "extension.extra" : undefined,
    req.coverUrl !== undefined ? "translations" : undefined,
    req.rating !== undefined ? "unit.rating" : undefined,
    req.visibility !== undefined ? "unit.visibility" : undefined,
    req.licenseSlug !== undefined ? "unit.license" : undefined,
  ]);
}

type CurrentBookMetadata = {
  isbn13: string | null;
  publicationDate: Date | string | null;
  pageCount: number | null;
  textLength: number;
  formatKey: string | null;
  isLicensed: boolean;
  extra: unknown;
  unit: {
    rating: string;
    visibility: string;
    licenseSlug: string | null;
    defaultLanguage: string | null;
  };
};

function mapBookEffectiveUpdatePatchPaths(
  req: UpdateBookInput,
  current: CurrentBookMetadata,
  currentTranslationExtra: unknown,
  language: string,
) {
  return uniquePatchPaths([
    hasOwn(req, "isbn13") && (req.isbn13 ?? null) !== current.isbn13
      ? "extension.isbn13"
      : undefined,
    hasOwn(req, "publicationDate") &&
    !sameDateValue(req.publicationDate ?? null, current.publicationDate)
      ? "extension.publicationDate"
      : undefined,
    hasOwn(req, "pageCount") && (req.pageCount ?? null) !== current.pageCount
      ? "extension.pageCount"
      : undefined,
    hasOwn(req, "textLength") && req.textLength !== current.textLength
      ? "extension.textLength"
      : undefined,
    hasOwn(req, "formatKey") && (req.formatKey ?? null) !== current.formatKey
      ? "extension.formatKey"
      : undefined,
    hasOwn(req, "isLicensed") && req.isLicensed !== current.isLicensed
      ? "extension.isLicensed"
      : undefined,
    hasOwn(req, "extra") && !sameJson(req.extra ?? null, current.extra)
      ? "extension.extra"
      : undefined,
    hasOwn(req, "coverUrl") &&
    !sameJson(
      withCoverUrl(
        (currentTranslationExtra ?? undefined) as
          | Record<string, unknown>
          | undefined,
        req.coverUrl ?? undefined,
      ),
      currentTranslationExtra,
    )
      ? `translations.${language}.extra`
      : undefined,
    hasOwn(req, "rating") && req.rating !== current.unit.rating
      ? "unit.rating"
      : undefined,
    hasOwn(req, "visibility") && req.visibility !== current.unit.visibility
      ? "unit.visibility"
      : undefined,
    hasOwn(req, "licenseSlug") &&
    (assertLicenseSlug(req.licenseSlug) ?? null) !== current.unit.licenseSlug
      ? "unit.license"
      : undefined,
  ]);
}

function buildBookUpdatePatchFromPaths(
  req: UpdateBookInput,
  paths: readonly string[],
  language: string,
): Record<string, unknown> {
  const pathSet = new Set(paths);
  const extension: Record<string, unknown> = {};
  if (pathSet.has("extension.isbn13")) extension.isbn13 = req.isbn13;
  if (pathSet.has("extension.publicationDate"))
    extension.publicationDate = req.publicationDate;
  if (pathSet.has("extension.pageCount")) extension.pageCount = req.pageCount;
  if (pathSet.has("extension.textLength"))
    extension.textLength = req.textLength;
  if (pathSet.has("extension.formatKey")) extension.formatKey = req.formatKey;
  if (pathSet.has("extension.isLicensed"))
    extension.isLicensed = req.isLicensed;
  if (pathSet.has("extension.extra")) extension.extra = req.extra;

  const unit: Record<string, unknown> = {};
  if (pathSet.has("unit.rating")) unit.rating = req.rating;
  if (pathSet.has("unit.visibility")) unit.visibility = req.visibility;
  if (pathSet.has("unit.license")) unit.license = req.licenseSlug;

  const translations =
    pathSet.has(`translations.${language}.extra`) && req.coverUrl !== undefined
      ? {
          [language]: {
            extra: { coverUrl: req.coverUrl ?? null },
          },
        }
      : undefined;

  return {
    ...(Object.keys(extension).length > 0 ? { extension } : {}),
    ...(Object.keys(unit).length > 0 ? { unit } : {}),
    ...(translations ? { translations } : {}),
  };
}

function sameDateValue(
  left: string | Date | null,
  right: string | Date | null,
): boolean {
  const normalize = (value: string | Date | null) =>
    value == null ? null : new Date(value).toISOString();
  return normalize(left) === normalize(right);
}

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

function nodeSnapshot(row: ExistingRow | PlannedNode) {
  return {
    nodeId: row.id,
    title: row.title,
    chapterUnitId: row.chapterUnitId,
    noContent: row.noContent,
    rating: row.rating,
  };
}

function nodePlacement(row: ExistingRow | PlannedNode) {
  return {
    parentId: row.parentId,
    sortKey: row.sortKey,
  };
}

function countDescendants(
  nodeId: string,
  rowsByParentId: ReadonlyMap<string | null, readonly ExistingRow[]>,
): number {
  const children = rowsByParentId.get(nodeId) ?? [];
  return children.reduce(
    (total, child) => total + 1 + countDescendants(child.id, rowsByParentId),
    0,
  );
}

export function planContentStructureOperations(
  current: readonly ExistingRow[],
  planned: readonly PlannedNode[],
): ContentStructureBatchOperation[] {
  const currentById = new Map(current.map((row) => [row.id, row]));
  const plannedById = new Map(planned.map((row) => [row.id, row]));
  const rowsByParentId = new Map<string | null, ExistingRow[]>();
  for (const row of current) {
    const siblings = rowsByParentId.get(row.parentId) ?? [];
    siblings.push(row);
    rowsByParentId.set(row.parentId, siblings);
  }

  const operations: ContentStructureBatchOperation[] = [];

  for (const row of current) {
    if (plannedById.has(row.id)) continue;
    operations.push({
      op: "node.delete",
      node: nodeSnapshot(row),
      placement: nodePlacement(row),
      descendantCount: countDescendants(row.id, rowsByParentId),
    });
  }

  for (const plan of planned) {
    const existing = currentById.get(plan.id);
    if (!existing) {
      operations.push({
        op: "node.create",
        node: nodeSnapshot(plan),
        placement: nodePlacement(plan),
      });
      continue;
    }

    const beforeUpdate: Partial<ReturnType<typeof nodeSnapshot>> = {};
    const afterUpdate: Partial<ReturnType<typeof nodeSnapshot>> = {};
    if (existing.title !== plan.title) {
      beforeUpdate.title = existing.title;
      afterUpdate.title = plan.title;
    }
    if (existing.noContent !== plan.noContent) {
      beforeUpdate.noContent = existing.noContent;
      afterUpdate.noContent = plan.noContent;
    }
    if ((existing.rating ?? null) !== (plan.rating ?? null)) {
      beforeUpdate.rating = existing.rating;
      afterUpdate.rating = plan.rating;
    }
    if (Object.keys(afterUpdate).length > 0) {
      operations.push({
        op: "node.update",
        nodeId: plan.id,
        before: beforeUpdate,
        after: afterUpdate,
      });
    }

    if (
      existing.parentId !== plan.parentId ||
      existing.sortKey !== plan.sortKey
    ) {
      operations.push({
        op: "node.move",
        nodeId: plan.id,
        before: nodePlacement(existing),
        after: nodePlacement(plan),
      });
    }

    const beforeChapterUnitId = existing.chapterUnitId ?? null;
    const afterChapterUnitId = plan.chapterUnitId ?? null;
    if (beforeChapterUnitId !== afterChapterUnitId) {
      if (beforeChapterUnitId) {
        operations.push({
          op: "node.unlink",
          nodeId: plan.id,
          beforeChapterUnitId,
        });
      }
      if (afterChapterUnitId) {
        operations.push({
          op: "node.link",
          nodeId: plan.id,
          beforeChapterUnitId,
          afterChapterUnitId,
        });
      }
    }
  }

  return operations;
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
