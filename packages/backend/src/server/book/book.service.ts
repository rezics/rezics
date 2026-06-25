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
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/contract/job";
import { and, asc, count, desc, eq, ilike, inArray, sql } from "drizzle-orm";
import { nullableContentDocJson } from "@/content-doc/json-write";
import { contentStructureService } from "@/content-structure";
import { countReadableContentStructureItems } from "@/content-structure/types";
import {
  Book,
  ContentStructure,
  CreditAttribution,
  Entity,
  Unit,
  UnitFieldLock,
  UnitSupportLanguage,
  UnitTag,
  UnitTranslation,
  User,
} from "@/db/schema";
import { resolveRezicsWikiUserId } from "@/infra/infra-users";
import { serverJobProducer } from "@/job/job-boundary";
import {
  assertCanEditCollaborativeMetadata,
  createDrizzleCollaborativeMetadataTx,
  hasOwn,
  mapActualTranslationPatchPaths,
  sameJson,
  translationPatchFromPaths,
  uniquePatchPaths,
  writeEditorialMetadataHistory,
} from "@/unit/collaborative-metadata";
import { assertLicenseSlug } from "@/unit/publication-policy";
import { assertUnitTranslationExtraAllowed } from "@/unit/translation-extra";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import type { BookWithRelations } from "./types";

type BookHydrationDb = Awaited<ReturnType<typeof getServerDb>>;
type BookListOptions = Omit<BookListQuery, "languages"> & {
  languages?: string | readonly string[];
};

export type BookRepository = {
  list(options: BookListOptions): Promise<{
    books: BookWithRelations[];
    total: number;
  }>;
  getByUnitId(unitId: string): Promise<BookWithRelations>;
  getByIsbn13(isbn13: string): Promise<BookWithRelations | null>;
  create(req: CreateBookInput): Promise<BookWithRelations>;
  update(
    unitId: string,
    req: UpdateBookInput,
    actor?: RezicsSessionClaims,
    historyInput?: Pick<
      EditorialPatchSubmission,
      "patch" | "message" | "restoreSource"
    >,
  ): Promise<BookWithRelations>;
  updateChapterCount(
    tx: unknown,
    unitId: string,
    chapterCount: number,
  ): Promise<void>;
  delete(unitId: string): Promise<void>;
  exists(unitId: string): Promise<boolean>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function publicUserColumns() {
  return {
    unitId: User.unitId,
    name: User.name,
    avatar: User.avatar,
    summary: User.summary,
    description: User.description,
    followersCount: User.followersCount,
    followingsCount: User.followingsCount,
  };
}

async function hydrateBook(
  database: BookHydrationDb,
  unitId: string,
): Promise<BookWithRelations | null> {
  const [row] = await database
    .select({ book: Book, unit: Unit, user: publicUserColumns() })
    .from(Book)
    .innerJoin(Unit, eq(Book.unitId, Unit.id))
    .leftJoin(User, eq(Unit.userId, User.unitId))
    .where(eq(Book.unitId, unitId))
    .limit(1);
  if (!row) return null;

  const [translations, supportLanguages, creditRows] = await Promise.all([
    database
      .select()
      .from(UnitTranslation)
      .where(eq(UnitTranslation.unitId, unitId)),
    database
      .select()
      .from(UnitSupportLanguage)
      .where(eq(UnitSupportLanguage.unitId, unitId))
      .orderBy(
        asc(UnitSupportLanguage.position),
        asc(UnitSupportLanguage.language),
      ),
    database
      .select({
        credit: CreditAttribution,
        entityUnit: Unit,
        entity: Entity,
      })
      .from(CreditAttribution)
      .innerJoin(Unit, eq(CreditAttribution.entityId, Unit.id))
      .leftJoin(Entity, eq(CreditAttribution.entityId, Entity.unitId))
      .where(eq(CreditAttribution.unitId, unitId))
      .orderBy(
        asc(CreditAttribution.position),
        asc(CreditAttribution.entityId),
      ),
  ]);

  const entityUnitIds = creditRows.map((credit) => credit.entityUnit.id);
  const entityTranslations =
    entityUnitIds.length === 0
      ? []
      : await database
          .select()
          .from(UnitTranslation)
          .where(inArray(UnitTranslation.unitId, entityUnitIds));
  const entityTranslationsByUnitId = new Map<
    string,
    Array<typeof UnitTranslation.$inferSelect>
  >();
  for (const tr of entityTranslations) {
    const list = entityTranslationsByUnitId.get(tr.unitId) ?? [];
    list.push(tr);
    entityTranslationsByUnitId.set(tr.unitId, list);
  }

  return {
    ...row.book,
    unit: {
      ...row.unit,
      user: row.user,
      translations,
      supportLanguages,
      creditAttributions: creditRows.map((credit) => ({
        ...credit.credit,
        entity: {
          ...credit.entityUnit,
          entity: credit.entity,
          translations:
            entityTranslationsByUnitId.get(credit.entityUnit.id) ?? [],
        },
      })),
    },
  };
}

async function hydrateBookOrThrow(
  database: BookHydrationDb,
  unitId: string,
): Promise<BookWithRelations> {
  const row = await hydrateBook(database, unitId);
  if (!row) throw new Error(`Book not found: ${unitId}`);
  return row;
}

function bookListWhere(options: BookListOptions) {
  const conditions = [eq(Unit.type, "BOOK")];

  if (options.rating) conditions.push(eq(Unit.rating, options.rating as never));
  if (options.isbn13?.trim()) {
    conditions.push(ilike(Book.isbn13, `%${options.isbn13.trim()}%`));
  }
  if (options.userId?.trim()) conditions.push(eq(Unit.userId, options.userId));
  if (options.entityId?.trim()) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM "CreditAttribution" ca
      WHERE ca."unitId" = ${Book.unitId}
        AND ca."entityId" = ${options.entityId}
    )`);
  }

  const tagList = (options.tagUnitIds ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (tagList.length > 0) {
    const tagIds = sql.join(
      tagList.map((id) => sql`${id}`),
      sql`, `,
    );
    conditions.push(sql`EXISTS (
      SELECT 1 FROM "UnitTag" tag
      WHERE tag."unitId" = ${Book.unitId}
        AND tag."tagUnitId" IN (${tagIds})
    )`);
  }

  if (options.language?.trim()) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM "UnitTranslation" tr
      WHERE tr."unitId" = ${Book.unitId}
        AND tr."language" = ${options.language}
    )`);
  }

  if (options.visibility?.trim()) {
    conditions.push(eq(Unit.visibility, options.visibility as never));
  }
  if (options.status?.trim()) {
    conditions.push(eq(Unit.status, options.status as never));
  }
  if (options.moderationStatus?.trim()) {
    conditions.push(
      eq(Unit.moderationStatus, options.moderationStatus as never),
    );
  }

  const idList = parseIdsCsv(options.ids);
  if (idList && idList.length > 0) {
    conditions.push(inArray(Book.unitId, idList));
  }

  return and(...conditions);
}

function createDrizzleBookRepository(): BookRepository {
  return {
    async list(options) {
      const db = await getServerDb();
      const cursor = options.cursor;
      const hasCursor = cursor?.unitId && cursor?.createdAt;
      const limit = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
      const where = bookListWhere(options);
      const sortField =
        options.sort?.type === "updatedAt" ? Book.updatedAt : Book.createdAt;
      const sortOrder =
        options.sort?.order?.toLowerCase() === "asc" ? asc : desc;

      const [rows, totalRows] = await Promise.all([
        db
          .select({ unitId: Book.unitId })
          .from(Book)
          .innerJoin(Unit, eq(Book.unitId, Unit.id))
          .where(where)
          .orderBy(sortOrder(sortField))
          .offset(hasCursor ? 1 : (options.start ?? 0))
          .limit(limit),
        db
          .select({ value: count() })
          .from(Book)
          .innerJoin(Unit, eq(Book.unitId, Unit.id))
          .where(where),
      ]);

      return {
        books: await hydrateUnitOwnerUserSlugs(
          await Promise.all(
            rows.map((row) => hydrateBookOrThrow(db, row.unitId)),
          ),
        ),
        total: totalRows[0]?.value ?? 0,
      };
    },
    async getByUnitId(unitId) {
      const db = await getServerDb();
      return hydrateUnitOwnerUserSlugRow(await hydrateBookOrThrow(db, unitId));
    },
    async getByIsbn13(isbn13) {
      const db = await getServerDb();
      const [row] = await db
        .select({ unitId: Book.unitId })
        .from(Book)
        .where(eq(Book.isbn13, isbn13))
        .limit(1);
      if (!row) return null;
      return hydrateUnitOwnerUserSlugRow(
        await hydrateBookOrThrow(db, row.unitId),
      );
    },
    async create(req) {
      const db = await getServerDb();
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
          title: tr.title ?? null,
          subtitle: tr.subtitle ?? null,
          summary: tr.summary ?? null,
          description: nullableContentDocJson(tr.description),
          extra: nextExtra ?? null,
          sourceUnitId: tr.sourceUnitId ?? null,
        };
      });

      const unitId = await db.transaction(async (tx) => {
        const now = new Date();
        const [unit] = await tx
          .insert(Unit)
          .values({
            userId: ownerUserId || null,
            slugScope: ownerUserId,
            type: "BOOK",
            status: "PUBLISHED",
            visibility: req.visibility as typeof Unit.$inferInsert.visibility,
            licenseSlug: assertLicenseSlug(req.licenseSlug) ?? null,
            aiDisclosureMode:
              req.aiDisclosureMode as typeof Unit.$inferInsert.aiDisclosureMode,
            aiDisclosureDetails: req.aiDisclosureDetails ?? null,
            defaultLanguage: req.defaultLanguage ?? null,
            rating: req.rating as typeof Unit.$inferInsert.rating,
            updatedAt: now,
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create Book Unit");

        if (translationData.length > 0) {
          await tx.insert(UnitTranslation).values(
            translationData.map((tr) => ({
              unitId: unit.id,
              ...tr,
              updatedAt: now,
            })),
          );
        }

        if (req.creationMode !== "wiki" && actorUserId) {
          await tx.insert(UnitFieldLock).values({
            unitId: unit.id,
            path: "*",
            lockedById: actorUserId,
            reason: "Personal creation starts closed to community edits.",
          });
        }

        await tx.insert(Book).values({
          unitId: unit.id,
          isbn13: req.isbn13 ?? null,
          publicationDate: req.publicationDate
            ? new Date(req.publicationDate as never)
            : null,
          pageCount: req.pageCount ?? null,
          textLength: req.textLength ?? 0,
          chapterCount: 0,
          formatKey: req.formatKey ?? null,
          isLicensed: req.isLicensed ?? false,
          extra: req.extra ?? null,
          updatedAt: now,
        });
        await tx
          .insert(ContentStructure)
          .values({ ownerUnitId: unit.id, updatedAt: now })
          .onConflictDoNothing();

        if (actorUserId) {
          await writeEditorialMetadataHistory(
            createDrizzleCollaborativeMetadataTx(tx),
            {
              unitId: unit.id,
              actorUserId,
              patch: buildBookCreatePatch(req, ensuredTranslations, language),
              message: "book.create",
            },
          );
        }

        return unit.id;
      });

      return hydrateUnitOwnerUserSlugRow(await hydrateBookOrThrow(db, unitId));
    },
    async update(unitId, req, actor, historyInput) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        const [current] = await tx
          .select({
            isbn13: Book.isbn13,
            publicationDate: Book.publicationDate,
            pageCount: Book.pageCount,
            textLength: Book.textLength,
            formatKey: Book.formatKey,
            isLicensed: Book.isLicensed,
            extra: Book.extra,
            defaultLanguage: Unit.defaultLanguage,
            rating: Unit.rating,
            aiDisclosureMode: Unit.aiDisclosureMode,
            aiDisclosureDetails: Unit.aiDisclosureDetails,
            visibility: Unit.visibility,
            licenseSlug: Unit.licenseSlug,
          })
          .from(Book)
          .innerJoin(Unit, eq(Book.unitId, Unit.id))
          .where(eq(Book.unitId, unitId))
          .limit(1);
        if (!current) throw new Error(`Book not found: ${unitId}`);

        const language = current.defaultLanguage ?? "en";
        const [existingCoverTranslation] =
          req.coverUrl !== undefined
            ? await tx
                .select({ extra: UnitTranslation.extra })
                .from(UnitTranslation)
                .where(
                  and(
                    eq(UnitTranslation.unitId, unitId),
                    eq(UnitTranslation.language, language),
                  ),
                )
                .limit(1)
            : [null];
        const currentForPatch = {
          isbn13: current.isbn13,
          publicationDate: current.publicationDate,
          pageCount: current.pageCount,
          textLength: current.textLength,
          formatKey: current.formatKey,
          isLicensed: current.isLicensed,
          extra: current.extra,
          unit: {
            defaultLanguage: current.defaultLanguage,
            rating: current.rating,
            aiDisclosureMode: current.aiDisclosureMode,
            aiDisclosureDetails: current.aiDisclosureDetails,
            visibility: current.visibility,
            licenseSlug: current.licenseSlug,
          },
        };
        const patchPaths = mapBookEffectiveUpdatePatchPaths(
          req,
          currentForPatch,
          existingCoverTranslation?.extra ?? null,
          language,
        );
        const patch = buildBookUpdatePatchFromPaths(req, patchPaths, language);

        if (patchPaths.length === 0) return;

        const collaborativeTx = createDrizzleCollaborativeMetadataTx(tx);
        if (actor) {
          await assertCanEditCollaborativeMetadata(
            collaborativeTx,
            actor,
            unitId,
            patchPaths,
          );
        }

        if (req.coverUrl !== undefined) {
          const nextExtra = withCoverUrl(
            existingCoverTranslation?.extra ?? undefined,
            req.coverUrl ?? undefined,
          );
          assertUnitTranslationExtraAllowed(nextExtra);
          await tx
            .insert(UnitTranslation)
            .values({
              unitId,
              language,
              extra: nextExtra,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [UnitTranslation.unitId, UnitTranslation.language],
              set: { extra: nextExtra, updatedAt: new Date() },
            });
        }

        const bookPatch: Partial<typeof Book.$inferInsert> = {};
        if (req.isbn13 !== undefined) bookPatch.isbn13 = req.isbn13;
        if (req.publicationDate !== undefined) {
          bookPatch.publicationDate = req.publicationDate
            ? new Date(req.publicationDate as never)
            : null;
        }
        if (req.pageCount !== undefined) bookPatch.pageCount = req.pageCount;
        if (req.textLength !== undefined) bookPatch.textLength = req.textLength;
        if (req.formatKey !== undefined) bookPatch.formatKey = req.formatKey;
        if (req.isLicensed !== undefined) bookPatch.isLicensed = req.isLicensed;
        if (req.extra !== undefined) bookPatch.extra = req.extra ?? null;
        if (Object.keys(bookPatch).length > 0) {
          await tx
            .update(Book)
            .set({ ...bookPatch, updatedAt: new Date() })
            .where(eq(Book.unitId, unitId));
        }

        const unitPatch: Partial<typeof Unit.$inferInsert> = {};
        if (req.rating !== undefined) unitPatch.rating = req.rating as never;
        if (req.aiDisclosureMode !== undefined) {
          unitPatch.aiDisclosureMode = req.aiDisclosureMode as never;
        }
        if (req.aiDisclosureDetails !== undefined) {
          unitPatch.aiDisclosureDetails = req.aiDisclosureDetails ?? null;
        }
        if (req.visibility !== undefined) {
          unitPatch.visibility = req.visibility as never;
        }
        if (req.licenseSlug !== undefined) {
          unitPatch.licenseSlug =
            req.licenseSlug === null
              ? null
              : (assertLicenseSlug(req.licenseSlug) ?? null);
        }
        if (Object.keys(unitPatch).length > 0) {
          await tx
            .update(Unit)
            .set({ ...unitPatch, updatedAt: new Date() })
            .where(eq(Unit.id, unitId));
        }

        if (actor) {
          await writeEditorialMetadataHistory(collaborativeTx, {
            unitId,
            actorUserId: actor.userId,
            patch: historyInput?.patch ?? patch,
            message: historyInput?.message ?? "book.metadata.update",
            restoreSource: historyInput?.restoreSource,
          });
        }
      });

      return hydrateUnitOwnerUserSlugRow(await hydrateBookOrThrow(db, unitId));
    },
    async updateChapterCount(tx, unitId, chapterCount) {
      const inner =
        tx && typeof tx === "object" && "update" in tx
          ? (tx as any)
          : await getServerDb();
      await inner
        .update(Book)
        .set({ chapterCount, updatedAt: new Date() })
        .where(eq(Book.unitId, unitId));
    },
    async delete(unitId) {
      const db = await getServerDb();
      await db.delete(Unit).where(eq(Unit.id, unitId));
    },
    async exists(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ value: count() })
        .from(Book)
        .where(eq(Book.unitId, unitId));
      return (row?.value ?? 0) > 0;
    },
  };
}

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
 * 图书服务 - 业务逻辑层
 */
export class BookService {
  constructor(
    private readonly repository: BookRepository = createDrizzleBookRepository(),
  ) {}

  /**
   * List books with filters and pagination
   * 使用过滤条件和分页列出图书
   */
  async list(options: BookListOptions = {}): Promise<{
    books: BookWithRelations[];
    total: number;
  }> {
    return this.repository.list(options);
  }

  async getByUnitId(unitId: string): Promise<BookWithRelations> {
    return this.repository.getByUnitId(unitId);
  }

  /**
   * Get content structure by bookUnitId. Reads all node rows for the book and
   * adapts the generic ContentStructure tree to the book-domain response shape.
   * 按 bookUnitId 获取内容结构。读取该图书的所有节点行，并将通用的
   * ContentStructure 树适配为图书领域的响应结构。
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

  async getByIsbn13(isbn13: string): Promise<BookWithRelations | null> {
    return this.repository.getByIsbn13(isbn13);
  }

  /**
   * Create new book (Unit + Book extension + translations in one transaction)
   * 创建新图书（在单个事务中创建 Unit + Book 扩展 + 翻译）
   */
  async create(req: CreateBookInput): Promise<BookWithRelations> {
    const book = await this.repository.create(req);
    await enqueueContentSync(book.unitId);
    return book;
  }

  async update(
    unitId: string,
    req: UpdateBookInput,
    actor?: RezicsSessionClaims,
    historyInput?: Pick<
      EditorialPatchSubmission,
      "patch" | "message" | "restoreSource"
    >,
  ): Promise<BookWithRelations> {
    const book = await this.repository.update(unitId, req, actor, historyInput);

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

    return book;
  }

  /**
   * Update content structure (diff-based TOC save).
   *
   * Walks the submitted tree, diffs against current ContentStructureNode
   * rows, and applies the minimum set of INSERT / UPDATE / DELETE in a single
   * transaction. Preserves existing `position` values when sibling order is
   * unchanged so a no-op save produces zero row mutations. The container
   * `updatedAt` is bumped only when at least one node actually changed.
   *
   * 更新内容结构（基于差异的目录保存）。
   *
   * 遍历提交的树，与当前的 ContentStructureNode 行做差异比较，并在单个事务中
   * 应用最小集合的 INSERT / UPDATE / DELETE。当兄弟节点顺序未变时保留现有的
   * `position` 值，因此空操作保存不会产生任何行变更。仅当至少有一个节点确实
   * 发生变化时才更新容器的 `updatedAt`。
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
        await this.repository.updateChapterCount(tx, unitId, chapterCount);
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
   * 按 unitId 删除图书（通过 Unit 删除级联）
   */
  async delete(unitId: string): Promise<void> {
    await this.repository.delete(unitId);
    await enqueueContentDelete(unitId);
  }

  async exists(unitId: string): Promise<boolean> {
    return this.repository.exists(unitId);
  }
}

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
