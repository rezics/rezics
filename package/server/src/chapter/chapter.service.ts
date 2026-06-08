import type {
  ChapterListQuery,
  ChapterMaterializationRequest,
  ChapterMaterializationResponse,
  CreateChapterInput,
  UpdateChapterInput,
} from "@rezics/contract";
import {
  markdownContentDoc,
  parseIdsCsv,
  withCoverUrl,
} from "@rezics/contract";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  lte,
  sql,
} from "drizzle-orm";
import {
  ContentStructure,
  ContentStructureNode,
  ContentTranslation,
  Post,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  User,
} from "../db/schema";
import type { ChapterPostWithRelations } from "./types";

type ChapterTarget = {
  id?: string;
  type: string;
  defaultLanguage?: string | null;
};

export type ChapterRepository = {
  list(options: ChapterListQuery): Promise<{
    items: ChapterPostWithRelations[];
    total: number;
  }>;
  getByUnitId(unitId: string): Promise<ChapterPostWithRelations>;
  getUnitTarget(unitId: string): Promise<ChapterTarget | null>;
  create(
    req: CreateChapterInput,
    target: ChapterTarget,
  ): Promise<ChapterPostWithRelations>;
  materializeNode(
    bookUnitId: string,
    req: ChapterMaterializationRequest,
    userId: string,
  ): Promise<ChapterMaterializationResponse>;
  update(
    unitId: string,
    req: UpdateChapterInput,
  ): Promise<ChapterPostWithRelations>;
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
    bio: User.bio,
    description: User.description,
    followersCount: User.followersCount,
    followingsCount: User.followingsCount,
  };
}

async function hydrateChapterPost(
  database: Awaited<ReturnType<typeof getServerDb>>,
  unitId: string,
): Promise<ChapterPostWithRelations | null> {
  const [row] = await database
    .select({ post: Post, unit: Unit, user: publicUserColumns() })
    .from(Post)
    .innerJoin(Unit, eq(Post.unitId, Unit.id))
    .leftJoin(User, eq(Unit.userId, User.unitId))
    .where(eq(Post.unitId, unitId))
    .limit(1);
  if (!row) return null;

  const [translations, contentTranslations, supportLanguages] =
    await Promise.all([
      database
        .select()
        .from(UnitTranslation)
        .where(eq(UnitTranslation.unitId, unitId)),
      database
        .select()
        .from(ContentTranslation)
        .where(eq(ContentTranslation.unitId, unitId)),
      database
        .select()
        .from(UnitSupportLanguage)
        .where(eq(UnitSupportLanguage.unitId, unitId)),
    ]);

  return {
    ...row.post,
    unit: {
      ...row.unit,
      user: row.user,
      translations,
      contentTranslations,
      supportLanguages,
    },
  };
}

async function hydrateChapterPostOrThrow(
  database: Awaited<ReturnType<typeof getServerDb>>,
  unitId: string,
): Promise<ChapterPostWithRelations> {
  const row = await hydrateChapterPost(database, unitId);
  if (!row) throw new Error(`Chapter not found: ${unitId}`);
  return row;
}

function listValue(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function contentStatus(unitStatus: string): "DRAFT" | "PUBLISHED" {
  return unitStatus === "DRAFT" ? "DRAFT" : "PUBLISHED";
}

function createDrizzleChapterRepository(): ChapterRepository {
  return {
    async list(options) {
      const db = await getServerDb();
      const cursor = options.cursor;
      const hasCursor = cursor?.unitId && cursor?.createdAt;
      const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
      const skipNum = hasCursor ? 1 : (options.start ?? 0);
      const conditions = [eq(Post.kind, "CHAPTER")];

      if (options.q?.trim()) {
        const q = options.q.trim();
        conditions.push(sql`EXISTS (
          SELECT 1 FROM "UnitTranslation" tr
          WHERE tr."unitId" = ${Post.unitId}
            AND tr."title" ILIKE ${`%${q}%`}
        )`);
      }
      if (options.userId?.trim()) {
        conditions.push(eq(Post.authorUserId, options.userId));
      }
      const statuses = listValue(options.status);
      if (statuses.length > 0) {
        conditions.push(inArray(Unit.status, statuses as never));
      }
      const targetIds = listValue(
        options.targetUnitIds ?? options.targetUnitId,
      );
      if (targetIds.length > 0) {
        conditions.push(inArray(Unit.targetUnitId, targetIds));
      }
      if (options.createdAtFrom) {
        conditions.push(gte(Post.createdAt, new Date(options.createdAtFrom)));
      }
      if (options.createdAtTo) {
        conditions.push(lte(Post.createdAt, new Date(options.createdAtTo)));
      }
      const ids = parseIdsCsv(options.ids);
      if (ids && ids.length > 0) conditions.push(inArray(Post.unitId, ids));

      const where = and(...conditions);
      const sortColumn =
        options.sort?.type === "updatedAt" ? Post.updatedAt : Post.createdAt;
      const ascending = options.sort?.order === "asc";
      const [rows, totalRows] = await Promise.all([
        db
          .select({ unitId: Post.unitId })
          .from(Post)
          .innerJoin(Unit, eq(Post.unitId, Unit.id))
          .where(where)
          .orderBy(ascending ? sortColumn : desc(sortColumn))
          .offset(skipNum)
          .limit(limitNum),
        db
          .select({ value: count() })
          .from(Post)
          .innerJoin(Unit, eq(Post.unitId, Unit.id))
          .where(where),
      ]);

      const items = await Promise.all(
        rows.map((row) => hydrateChapterPostOrThrow(db, row.unitId)),
      );
      return { items, total: totalRows[0]?.value ?? 0 };
    },
    async getByUnitId(unitId) {
      const db = await getServerDb();
      return hydrateChapterPostOrThrow(db, unitId);
    },
    async getUnitTarget(unitId) {
      const db = await getServerDb();
      const [target] = await db
        .select({
          id: Unit.id,
          type: Unit.type,
          defaultLanguage: Unit.defaultLanguage,
        })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      return target ?? null;
    },
    async create(req, target) {
      const db = await getServerDb();
      const language = target.defaultLanguage ?? "en";
      const unitId = await db.transaction(async (tx) => {
        const now = new Date();
        const status = req.status || "PUBLISHED";
        const [unit] = await tx
          .insert(Unit)
          .values({
            userId: req.userId,
            slugScope: req.userId,
            type: "POST",
            targetUnitId: req.targetUnitId,
            status: status as typeof Unit.$inferInsert.status,
            defaultLanguage: language,
            rating: req.rating as typeof Unit.$inferInsert.rating,
            aiDisclosureMode:
              req.aiDisclosureMode as typeof Unit.$inferInsert.aiDisclosureMode,
            aiDisclosureDetails:
              req.aiDisclosureDetails === undefined
                ? null
                : (req.aiDisclosureDetails ?? null),
            updatedAt: now,
          })
          .returning({ id: Unit.id, status: Unit.status });
        if (!unit) throw new Error("Failed to create chapter Unit");

        await tx.insert(UnitTranslation).values({
          unitId: unit.id,
          language,
          title: req.title,
          extra:
            req.coverUrl !== undefined
              ? withCoverUrl(undefined, req.coverUrl)
              : null,
          updatedAt: now,
        });
        await tx.insert(Post).values({
          unitId: unit.id,
          authorUserId: req.userId,
          kind: "CHAPTER",
          updatedAt: now,
        });
        await tx
          .insert(ContentTranslation)
          .values({
            unitId: unit.id,
            language,
            content: req.content ?? markdownContentDoc(""),
            status: contentStatus(unit.status),
            authorUserId: req.userId,
            provenance: { source: "chapter-content" },
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [ContentTranslation.unitId, ContentTranslation.language],
            set: {
              content: req.content ?? markdownContentDoc(""),
              status: contentStatus(unit.status),
              authorUserId: req.userId,
              provenance: { source: "chapter-content" },
              updatedAt: now,
            },
          });
        return unit.id;
      });
      return hydrateChapterPostOrThrow(db, unitId);
    },
    async materializeNode(bookUnitId, req, userId) {
      const db = await getServerDb();
      return db.transaction(async (tx) => {
        const [book] = await tx
          .select({
            id: Unit.id,
            type: Unit.type,
            defaultLanguage: Unit.defaultLanguage,
          })
          .from(Unit)
          .where(eq(Unit.id, bookUnitId))
          .limit(1);
        if (!book || book.type !== "BOOK") {
          throw new Error("bookUnitId must reference a Unit(type=BOOK)");
        }

        await tx.execute(sql`
          SELECT "ownerUnitId"
          FROM "ContentStructure"
          WHERE "ownerUnitId" = ${bookUnitId}
          FOR UPDATE
        `);

        const [contentStructure] = await tx
          .select({
            ownerUnitId: ContentStructure.ownerUnitId,
            updatedAt: ContentStructure.updatedAt,
          })
          .from(ContentStructure)
          .where(eq(ContentStructure.ownerUnitId, bookUnitId))
          .limit(1);
        if (!contentStructure) {
          throw new Error(`ContentStructure not found: ${bookUnitId}`);
        }

        // Node id is a stable uuidv7, so it cannot drift under reorder.
        // node id 是稳定的 uuidv7，因此不会在重排序时漂移。
        const [node] = await tx
          .select()
          .from(ContentStructureNode)
          .where(
            and(
              eq(ContentStructureNode.id, req.nodeId),
              eq(ContentStructureNode.ownerUnitId, bookUnitId),
              eq(ContentStructureNode.isDeleted, false),
            ),
          )
          .limit(1);
        if (!node) {
          throw new Error(`NotFound: ContentStructureNode ${req.nodeId}`);
        }

        if (node.contentUnitId) {
          return {
            bookUnitId,
            nodeId: node.id,
            contentUnitId: node.contentUnitId,
            alreadyMaterialized: true,
            bookContentStructureUpdatedAt: contentStructure.updatedAt,
          };
        }

        const now = new Date();
        const language = book.defaultLanguage ?? "en";
        const [unit] = await tx
          .insert(Unit)
          .values({
            userId,
            slugScope: userId,
            type: "POST",
            targetUnitId: bookUnitId,
            status: "PUBLISHED",
            defaultLanguage: language,
            rating: node.rating ?? undefined,
            updatedAt: now,
          })
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to materialize chapter Unit");

        await tx.insert(UnitTranslation).values({
          unitId: unit.id,
          language,
          title: node.title,
          updatedAt: now,
        });
        await tx.insert(Post).values({
          unitId: unit.id,
          authorUserId: userId,
          kind: "CHAPTER",
          updatedAt: now,
        });
        await tx
          .insert(ContentTranslation)
          .values({
            unitId: unit.id,
            language,
            content: markdownContentDoc(""),
            status: "PUBLISHED",
            authorUserId: userId,
            provenance: { source: "chapter-content" },
            updatedAt: now,
          })
          .onConflictDoUpdate({
            target: [ContentTranslation.unitId, ContentTranslation.language],
            set: {
              content: markdownContentDoc(""),
              status: "PUBLISHED",
              authorUserId: userId,
              provenance: { source: "chapter-content" },
              updatedAt: now,
            },
          });

        await tx
          .update(ContentStructureNode)
          .set({ contentUnitId: unit.id, updatedAt: now })
          .where(eq(ContentStructureNode.id, node.id));

        const [updatedContentStructure] = await tx
          .update(ContentStructure)
          .set({ updatedAt: now })
          .where(eq(ContentStructure.ownerUnitId, bookUnitId))
          .returning({ updatedAt: ContentStructure.updatedAt });

        return {
          bookUnitId,
          nodeId: node.id,
          contentUnitId: unit.id,
          alreadyMaterialized: false,
          bookContentStructureUpdatedAt:
            updatedContentStructure?.updatedAt ?? now,
        };
      });
    },
    async update(unitId, req) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        const now = new Date();

        if (req.content !== undefined) {
          const [existing] = await tx
            .select({
              authorUserId: Post.authorUserId,
              defaultLanguage: Unit.defaultLanguage,
              status: Unit.status,
            })
            .from(Post)
            .innerJoin(Unit, eq(Post.unitId, Unit.id))
            .where(eq(Post.unitId, unitId))
            .limit(1);
          if (!existing) throw new Error(`Chapter not found: ${unitId}`);
          const language = existing.defaultLanguage ?? "en";
          await tx
            .insert(ContentTranslation)
            .values({
              unitId,
              language,
              content: req.content,
              status: contentStatus(existing.status),
              authorUserId: existing.authorUserId,
              provenance: { source: "chapter-content" },
              updatedAt: now,
            })
            .onConflictDoUpdate({
              target: [ContentTranslation.unitId, ContentTranslation.language],
              set: {
                content: req.content,
                status: contentStatus(existing.status),
                authorUserId: existing.authorUserId,
                provenance: { source: "chapter-content" },
                updatedAt: now,
              },
            });
          await tx
            .update(ContentStructureNode)
            .set({ updatedAt: now })
            .where(eq(ContentStructureNode.contentUnitId, unitId));
        }

        if (
          req.targetUnitId !== undefined ||
          req.status ||
          req.rating !== undefined ||
          req.aiDisclosureMode !== undefined ||
          req.aiDisclosureDetails !== undefined
        ) {
          await tx
            .update(Unit)
            .set({
              ...(req.status ? { status: req.status as never } : {}),
              ...(req.targetUnitId !== undefined
                ? { targetUnitId: req.targetUnitId }
                : {}),
              ...(req.rating !== undefined
                ? { rating: req.rating as never }
                : {}),
              ...(req.aiDisclosureMode !== undefined
                ? { aiDisclosureMode: req.aiDisclosureMode as never }
                : {}),
              ...(req.aiDisclosureDetails !== undefined
                ? { aiDisclosureDetails: req.aiDisclosureDetails ?? null }
                : {}),
              updatedAt: now,
            })
            .where(eq(Unit.id, unitId));
        }

        if (req.title !== undefined || req.coverUrl !== undefined) {
          const [existing] = await tx
            .select()
            .from(UnitTranslation)
            .where(eq(UnitTranslation.unitId, unitId))
            .limit(1);
          const language =
            existing?.language ??
            (
              await tx
                .select({ defaultLanguage: Unit.defaultLanguage })
                .from(Unit)
                .where(eq(Unit.id, unitId))
                .limit(1)
            )[0]?.defaultLanguage ??
            "en";
          const nextExtra =
            req.coverUrl !== undefined
              ? withCoverUrl(existing?.extra, req.coverUrl ?? undefined)
              : undefined;

          if (existing) {
            await tx
              .update(UnitTranslation)
              .set({
                ...(req.title !== undefined ? { title: req.title } : {}),
                ...(nextExtra !== undefined ? { extra: nextExtra } : {}),
                updatedAt: now,
              })
              .where(
                and(
                  eq(UnitTranslation.unitId, unitId),
                  eq(UnitTranslation.language, existing.language),
                ),
              );
          } else {
            await tx.insert(UnitTranslation).values({
              unitId,
              language,
              title: req.title ?? "",
              extra: nextExtra,
              updatedAt: now,
            });
          }
        }

        if (req.title !== undefined) {
          const affected = await tx
            .select({ ownerUnitId: ContentStructureNode.ownerUnitId })
            .from(ContentStructureNode)
            .where(
              and(
                eq(ContentStructureNode.contentUnitId, unitId),
                eq(ContentStructureNode.isDeleted, false),
              ),
            );
          await tx
            .update(ContentStructureNode)
            .set({ title: req.title, updatedAt: now })
            .where(
              and(
                eq(ContentStructureNode.contentUnitId, unitId),
                eq(ContentStructureNode.isDeleted, false),
              ),
            );
          const ownerUnitIds = Array.from(
            new Set(affected.map((row) => row.ownerUnitId)),
          );
          if (ownerUnitIds.length > 0) {
            await tx
              .update(ContentStructure)
              .set({ updatedAt: now })
              .where(inArray(ContentStructure.ownerUnitId, ownerUnitIds));
          }
        }
      });

      return hydrateChapterPostOrThrow(db, unitId);
    },
    async delete(unitId) {
      const db = await getServerDb();
      await db.delete(Unit).where(eq(Unit.id, unitId));
    },
    async exists(unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ value: count() })
        .from(Post)
        .where(and(eq(Post.unitId, unitId), eq(Post.kind, "CHAPTER")));
      return (row?.value ?? 0) > 0;
    },
  };
}

/**
 * Thin wrapper over Post(kind=CHAPTER) — see chapter-as-post-and-cover-relocation.
 * 对 Post(kind=CHAPTER) 的薄封装 —— 参见 chapter-as-post-and-cover-relocation。
 *
 * Storage:
 * 存储：
 *   - Chapter title       -> UnitTranslation.title
 *   - Chapter cover URL   -> UnitTranslation.extra.coverUrl (typed)
 *   - Chapter content     -> ContentTranslation.content
 *   - Chapter parent book -> Unit.targetUnitId (must reference Unit(type=BOOK))
 *   - Chapter ordering    -> ContentStructureNode rows (out of scope of this service)
 *   - 章节标题   -> UnitTranslation.title
 *   - 章节封面 URL -> UnitTranslation.extra.coverUrl（带类型）
 *   - 章节内容   -> ContentTranslation.content
 *   - 章节所属书 -> Unit.targetUnitId（必须引用 Unit(type=BOOK)）
 *   - 章节排序   -> ContentStructureNode 行（不在本 service 范围内）
 */
export class ChapterService {
  constructor(
    private readonly repository: ChapterRepository = createDrizzleChapterRepository(),
  ) {}

  async list(options: ChapterListQuery = {}): Promise<{
    items: ChapterPostWithRelations[];
    total: number;
  }> {
    return this.repository.list(options);
  }

  async getByUnitId(unitId: string): Promise<ChapterPostWithRelations> {
    return this.repository.getByUnitId(unitId);
  }

  async create(req: CreateChapterInput): Promise<ChapterPostWithRelations> {
    const target = await this.repository.getUnitTarget(req.targetUnitId);
    if (!target || target.type !== "BOOK") {
      throw new Error(
        `Chapter targetUnitId must reference a Unit(type=BOOK); got ${target?.type ?? "missing"}`,
      );
    }
    return this.repository.create(req, target);
  }

  async materializeNode(
    bookUnitId: string,
    req: ChapterMaterializationRequest,
    userId: string,
  ): Promise<ChapterMaterializationResponse> {
    return this.repository.materializeNode(bookUnitId, req, userId);
  }

  async update(
    unitId: string,
    req: UpdateChapterInput,
  ): Promise<ChapterPostWithRelations> {
    if (req.targetUnitId !== undefined && req.targetUnitId !== null) {
      const target = await this.repository.getUnitTarget(req.targetUnitId);
      if (!target || target.type !== "BOOK") {
        throw new Error(
          `Chapter targetUnitId must reference a Unit(type=BOOK); got ${target?.type ?? "missing"}`,
        );
      }
    }
    return this.repository.update(unitId, req);
  }

  async delete(unitId: string): Promise<void> {
    await this.repository.delete(unitId);
  }

  async exists(unitId: string): Promise<boolean> {
    return this.repository.exists(unitId);
  }
}

export const chapterService = new ChapterService();
