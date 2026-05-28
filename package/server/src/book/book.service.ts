import type {
  BookContentStructureItem,
  BookContentStructureResponse,
  BookListQuery,
  CreateBookInput,
  EditorialPatchSubmission,
  RezicsSessionClaims,
  UpdateBookInput,
} from "@rezics/contract";
import { parseIdsCsv, withCoverUrl } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import type { Prisma } from "#/prisma/client";
import {
  type AiDisclosureMode,
  type ContentRating,
  prisma,
  UnitStatus,
  UnitType,
  type UnitVisibility,
  UnitVisibility as UnitVisibilityValue,
  UnitWorkDisplayPolicy,
  UnitWorkRole,
} from "#/prisma/client";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import { serverJobProducer } from "@/job/job-boundary";
import {
  assertCanEditCollaborativeMetadata,
  hasOwn,
  mapActualTranslationPatchPaths,
  sameJson,
  translationPatchFromPaths,
  uniquePatchPaths,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { contentStructureService } from "@/content-structure";
import { countReadableContentStructureItems } from "@/content-structure/types";
import { assertLicenseSlug } from "@/unit/publication-policy";
import { assertUnitTranslationExtraAllowed } from "@/unit/translation-extra";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
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

type WorkMatchResolution = {
  workUnitId: string | null;
  affectedUnitIds: string[];
};

async function resolveWorkMatch(
  tx: Prisma.TransactionClient,
  req: CreateBookInput,
  ownerUserId: string,
  language: string,
): Promise<WorkMatchResolution> {
  const explicitWorkUnitId = req.workUnitId?.trim();
  if (explicitWorkUnitId) {
    return { workUnitId: explicitWorkUnitId, affectedUnitIds: [] };
  }

  const matchedReleaseUnitId = req.workMatch?.releaseUnitId?.trim();
  if (!matchedReleaseUnitId) {
    return { workUnitId: null, affectedUnitIds: [] };
  }

  const matched = await tx.unit.findUniqueOrThrow({
    where: { id: matchedReleaseUnitId },
    select: {
      id: true,
      type: true,
      translations: {
        select: { language: true, title: true, subtitle: true, summary: true },
        orderBy: { language: "asc" },
      },
      workMemberships: {
        where: { role: UnitWorkRole.RELEASE },
        select: { workUnitId: true },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (matched.type !== UnitType.BOOK) {
    throw new Error(`Matched release is not a book: ${matchedReleaseUnitId}`);
  }

  const existingWorkUnitId = matched.workMemberships[0]?.workUnitId ?? null;
  if (existingWorkUnitId) {
    return { workUnitId: existingWorkUnitId, affectedUnitIds: [] };
  }

  const title =
    matched.translations.find((tr) => tr.language === language)?.title ??
    matched.translations[0]?.title ??
    "Matched work";
  const hiddenWork = await tx.book.create({
    data: {
      unit: {
        create: {
          userId: ownerUserId,
          slugScope: ownerUserId,
          type: UnitType.BOOK,
          status: UnitStatus.PUBLISHED,
          visibility: UnitVisibilityValue.PRIVATE,
          defaultLanguage: language,
          translations: {
            create: {
              language,
              title,
              subtitle: matched.translations[0]?.subtitle ?? undefined,
              summary: matched.translations[0]?.summary ?? undefined,
            },
          },
        },
      },
      textLength: 0,
      chapterCount: 0,
    },
    select: { unitId: true },
  });
  await contentStructureService.ensureForOwner(tx, hiddenWork.unitId);

  await tx.unitWork.create({
    data: {
      unitId: matchedReleaseUnitId,
      workUnitId: hiddenWork.unitId,
      role: UnitWorkRole.RELEASE,
      language: matched.translations[0]?.language ?? language,
      displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
    },
  });
  return {
    workUnitId: hiddenWork.unitId,
    affectedUnitIds: [matchedReleaseUnitId, hiddenWork.unitId],
  };
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

    // Filter release membership by canonical UnitWork relation.
    if (options.workUnitId?.trim()) {
      andWhere.push({
        unit: {
          workMemberships: {
            some: {
              workUnitId: options.workUnitId,
              role: "RELEASE",
            },
          },
        },
      });
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
   * assembles them server-side into the legacy `BookContentStructureItem[]` wire shape.
   */
  async getContentStructureByBookUnitId(
    bookUnitId: string,
  ): Promise<BookContentStructureResponse> {
    const structure =
      await contentStructureService.getByOwnerUnitId(bookUnitId);
    return {
      bookUnitId: structure.ownerUnitId,
      ownerUnitId: structure.ownerUnitId,
      nodes: structure.nodes,
      createdAt: structure.createdAt,
      updatedAt: structure.updatedAt,
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
      assertUnitTranslationExtraAllowed(nextExtra ?? null);
      return {
        language: tr.language,
        title: tr.title ?? undefined,
        subtitle: tr.subtitle ?? undefined,
        summary: tr.summary ?? undefined,
        description: nullableContentDocJson(tr.description),
        extra: (nextExtra ?? null) as Prisma.InputJsonValue,
        sourceUnitId: tr.sourceUnitId ?? undefined,
      };
    });

    const syncAfterCommit = new Set<string>();
    const book = await prisma.$transaction(async (tx) => {
      const workMatch = await resolveWorkMatch(tx, req, ownerUserId, language);
      for (const unitId of workMatch.affectedUnitIds) {
        syncAfterCommit.add(unitId);
      }
      const resolvedWorkUnitId = workMatch.workUnitId ?? undefined;
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
              aiDisclosureMode:
                (req.aiDisclosureMode as AiDisclosureMode | undefined) ??
                undefined,
              aiDisclosureDetails:
                req.aiDisclosureDetails === undefined
                  ? undefined
                  : ((req.aiDisclosureDetails ??
                      null) as Prisma.InputJsonValue),
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
        },
        include: bookInclude,
      });
      await contentStructureService.ensureForOwner(tx, created.unitId);

      if (resolvedWorkUnitId) {
        await tx.unitWork.upsert({
          where: {
            unitId_workUnitId_role: {
              unitId: created.unitId,
              workUnitId: resolvedWorkUnitId,
              role: UnitWorkRole.RELEASE,
            },
          },
          create: {
            unitId: created.unitId,
            workUnitId: resolvedWorkUnitId,
            role: UnitWorkRole.RELEASE,
            language,
            displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
          },
          update: {
            language,
            displayPolicy: UnitWorkDisplayPolicy.PRIMARY,
          },
        });
      }

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

    syncAfterCommit.add(book.unitId);
    await Promise.all(
      [...syncAfterCommit].map((unitId) => enqueueContentSync(unitId)),
    );

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
              aiDisclosureMode: true,
              aiDisclosureDetails: true,
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
        assertUnitTranslationExtraAllowed(nextExtra);
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
              aiDisclosureMode:
                (req.aiDisclosureMode as AiDisclosureMode | undefined) ??
                undefined,
              aiDisclosureDetails:
                req.aiDisclosureDetails === undefined
                  ? undefined
                  : ((req.aiDisclosureDetails ??
                      null) as Prisma.InputJsonValue),
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
    if (req.aiDisclosureMode !== undefined)
      patchFields.aiDisclosureMode = req.aiDisclosureMode;
    if (req.visibility !== undefined) patchFields.visibility = req.visibility;
    if (req.licenseSlug !== undefined)
      patchFields.licenseSlug = req.licenseSlug;
    await enqueueContentMetadata(unitId, patchFields);

    return hydrateUnitOwnerUserSlugRow(book as BookWithRelations);
  }

  /**
   * Update content structure (diff-based TOC save).
   *
   * Walks the submitted tree, diffs against current ContentStructureNode
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
    const response = await contentStructureService.update(unitId, submitted, {
      actorUserId: options.actorUserId,
      message: options.message,
      eventType: "contentStructure.content.batch",
      changedFieldKeys: ["contentStructure"],
      afterMutate: async (tx, { submitted: next }) => {
        const chapterCount = countReadableContentStructureItems(next);
        await tx.book.update({
          where: { unitId },
          data: { chapterCount },
        });
      },
    });
    return {
      bookUnitId: response.ownerUnitId,
      ownerUnitId: response.ownerUnitId,
      nodes: response.nodes,
      createdAt: response.createdAt,
      updatedAt: response.updatedAt,
    };
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
  if (req.aiDisclosureMode !== undefined)
    unit.aiDisclosureMode = req.aiDisclosureMode;
  if (req.aiDisclosureDetails !== undefined)
    unit.aiDisclosureDetails = req.aiDisclosureDetails;
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
      sourceUnitId: tr.sourceUnitId,
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
    req.aiDisclosureMode !== undefined ? "unit.aiDisclosureMode" : undefined,
    req.aiDisclosureDetails !== undefined
      ? "unit.aiDisclosureDetails"
      : undefined,
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
    aiDisclosureMode: string;
    aiDisclosureDetails: unknown;
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
    hasOwn(req, "aiDisclosureMode") &&
    req.aiDisclosureMode !== current.unit.aiDisclosureMode
      ? "unit.aiDisclosureMode"
      : undefined,
    hasOwn(req, "aiDisclosureDetails") &&
    !sameJson(req.aiDisclosureDetails ?? null, current.unit.aiDisclosureDetails)
      ? "unit.aiDisclosureDetails"
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
  if (pathSet.has("unit.aiDisclosureMode"))
    unit.aiDisclosureMode = req.aiDisclosureMode;
  if (pathSet.has("unit.aiDisclosureDetails"))
    unit.aiDisclosureDetails = req.aiDisclosureDetails;
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
