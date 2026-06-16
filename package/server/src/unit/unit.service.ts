import type {
  CreateUnitInput,
  UnitListQuery,
  UpdateUnitInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  and,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  ne,
  notInArray,
  or,
  sql,
} from "drizzle-orm";
import { nullableContentDocJson } from "@/content-doc/json-write";
import { pickSlugScope } from "@/infra/slug-scopes";
import { serverJobProducer } from "@/job/job-boundary";
import { cleanupReactions } from "@/reaction-boundary/reaction-boundary.client";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import { Unit, UnitSupportLanguage, UnitTranslation, User } from "../db/schema";
import {
  primarySupportLanguageCreate,
  resolveEffectiveReadLanguageCandidates,
} from "./language-resolution";
import {
  assertLicenseSlug,
  publicUnitEligibilityWhere,
} from "./publication-policy";
import { assertUnitTranslationExtraAllowed } from "./translation-extra";
import type { UnitWithRelations } from "./types";

type UnitFilterShape = Record<string, unknown>;

function enqueueContentCommand(
  kind:
    | typeof SEARCH_COMMAND_KINDS.contentSync
    | typeof SEARCH_COMMAND_KINDS.contentDelete,
  unitId: string,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(kind, { unitId }, { type: "server", service: "unit" }),
  );
}

function enqueueContentMetadataCommand(
  unitId: string,
  fields: Record<string, unknown>,
) {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchMetadata,
      { targetId: unitId, fields },
      { type: "server", service: "unit" },
    ),
  );
}

function catalogEntryKindValue(
  value:
    | CreateUnitInput["catalogEntryKind"]
    | UpdateUnitInput["catalogEntryKind"],
): string | null | undefined {
  return value === undefined ? undefined : (value ?? null);
}

/**
 * Compose the legacy serializable Unit list filter shape.
 *
 * The runtime query path below is Drizzle-native; this helper remains exported
 * for tests and callers that inspect filter intent without importing Drizzle.
 *
 * 构造旧版可序列化的 Unit 列表过滤结构。
 *
 * 下方的运行时查询路径是 Drizzle 原生实现；此 helper 仍被导出，供测试以及那些
 * 不导入 Drizzle 却需检视过滤意图的调用方使用。
 */
export function buildUnitWhereClause(options: UnitListQuery): UnitFilterShape {
  const andWhere: UnitFilterShape[] = [];

  if (options.q?.trim()) {
    const q = options.q.trim();
    andWhere.push({
      OR: [
        { id: q },
        { slug: { contains: q, mode: "insensitive" } },
        {
          translations: {
            some: {
              title: { contains: q, mode: "insensitive" },
            },
          },
        },
      ],
    });
  }

  if (options.id?.trim()) {
    andWhere.push({ id: options.id.trim() });
  }

  if (options.slug?.trim()) {
    andWhere.push({
      slug: { contains: options.slug.trim(), mode: "insensitive" },
    });
  }

  if (options.title?.trim()) {
    andWhere.push({
      translations: {
        some: {
          title: { contains: options.title.trim(), mode: "insensitive" },
        },
      },
    });
  }

  const typeList = (options.types ?? options.type ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (typeList.length > 0) andWhere.push({ type: { in: typeList } });
  else andWhere.push({ NOT: { type: "LABEL" } });

  const excludeTypeList = (options.excludeTypes ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (excludeTypeList.length > 0) {
    andWhere.push({ NOT: { type: { in: excludeTypeList } } });
  }

  const statusList = (options.statuses ?? options.status ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (statusList.length > 0) andWhere.push({ status: { in: statusList } });

  if (options.visibility?.trim()) {
    andWhere.push({ visibility: options.visibility });
  }

  const userList = (options.userIds ?? options.userId ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (userList.length > 0) andWhere.push({ userId: { in: userList } });

  if (options.catalogEntryKind !== undefined) {
    andWhere.push({ catalogEntryKind: options.catalogEntryKind ?? null });
  }

  if (options.targetUnitId !== undefined) {
    andWhere.push({ targetUnitId: options.targetUnitId ?? null });
  }

  if (options.language?.trim()) {
    andWhere.push({
      translations: {
        some: { language: options.language },
      },
    });
  }

  const readLanguages = resolveEffectiveReadLanguageCandidates({
    languages: (options as { languages?: string | readonly string[] })
      .languages,
    appLocale: (options as { appLocale?: string }).appLocale,
  });
  if (options.languageMode === "preferred" && readLanguages.length > 0) {
    andWhere.push({
      OR: [
        { isLanguageNeutral: true },
        {
          supportLanguages: { some: { language: { in: readLanguages } } },
        },
      ],
    });
  }

  if (options.rating) {
    andWhere.push({ rating: options.rating });
  }

  if (options.createdAtFrom) {
    andWhere.push({ createdAt: { gte: new Date(options.createdAtFrom) } });
  }
  if (options.createdAtTo) {
    andWhere.push({ createdAt: { lte: new Date(options.createdAtTo) } });
  }
  if (options.publishedAtFrom) {
    andWhere.push({ publishedAt: { gte: new Date(options.publishedAtFrom) } });
  }
  if (options.publishedAtTo) {
    andWhere.push({ publishedAt: { lte: new Date(options.publishedAtTo) } });
  }

  const idList = parseIdsCsv(options.ids);
  if (idList && idList.length > 0) {
    andWhere.push({ id: { in: idList } });
  }

  return andWhere.length > 0 ? { AND: andWhere } : {};
}

/**
 * Merge multiple serializable where inputs with AND semantics.
 * 以 AND 语义合并多个可序列化的 where 输入。
 */
export function mergeUnitWhereInputs(
  ...clauses: (UnitFilterShape | undefined)[]
): UnitFilterShape {
  const valid = clauses.filter(Boolean) as UnitFilterShape[];
  if (valid.length === 0) return {};
  if (valid.length === 1) return valid[0]!;
  return { AND: valid };
}

export function publicUnitWhere(): UnitFilterShape {
  return { ...publicUnitEligibilityWhere };
}

export type UnitRepository = {
  list(
    options: UnitListQuery,
  ): Promise<{ units: UnitWithRelations[]; total: number }>;
  getByUnitId(unitId: string): Promise<UnitWithRelations>;
  create(input: CreateUnitInput): Promise<UnitWithRelations>;
  update(unitId: string, input: UpdateUnitInput): Promise<UnitWithRelations>;
  getBySlug(input: {
    slugScope: string;
    slug: string;
  }): Promise<UnitWithRelations | null>;
  setSlug(unitId: string, slug: string): Promise<UnitWithRelations>;
  delete(unitId: string): Promise<void>;
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

async function hydrateUnit(
  database: Awaited<ReturnType<typeof getServerDb>>,
  unitId: string,
): Promise<UnitWithRelations | null> {
  const [row] = await database
    .select({ unit: Unit, user: publicUserColumns() })
    .from(Unit)
    .leftJoin(User, eq(Unit.userId, User.unitId))
    .where(eq(Unit.id, unitId))
    .limit(1);
  if (!row) return null;

  const [translations, supportLanguages] = await Promise.all([
    database
      .select()
      .from(UnitTranslation)
      .where(eq(UnitTranslation.unitId, unitId)),
    database
      .select()
      .from(UnitSupportLanguage)
      .where(eq(UnitSupportLanguage.unitId, unitId)),
  ]);

  return {
    ...row.unit,
    user: row.user,
    translations,
    supportLanguages,
  };
}

async function hydrateUnitOrThrow(
  database: Awaited<ReturnType<typeof getServerDb>>,
  unitId: string,
): Promise<UnitWithRelations> {
  const row = await hydrateUnit(database, unitId);
  if (!row) throw new Error(`Unit not found: ${unitId}`);
  return row;
}

function typeList(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function createUnitListConditions(options: UnitListQuery) {
  const conditions = [];

  if (options.q?.trim()) {
    const q = options.q.trim();
    conditions.push(
      or(
        sql`${Unit.id}::text = ${q}`,
        ilike(Unit.slug, `%${q}%`),
        sql`EXISTS (
          SELECT 1 FROM "UnitTranslation" tr
          WHERE tr."unitId" = ${Unit.id}
            AND tr."title" ILIKE ${`%${q}%`}
        )`,
      ),
    );
  }
  if (options.id?.trim()) conditions.push(eq(Unit.id, options.id.trim()));
  if (options.slug?.trim())
    conditions.push(ilike(Unit.slug, `%${options.slug.trim()}%`));
  if (options.title?.trim()) {
    const title = options.title.trim();
    conditions.push(sql`EXISTS (
      SELECT 1 FROM "UnitTranslation" tr
      WHERE tr."unitId" = ${Unit.id}
        AND tr."title" ILIKE ${`%${title}%`}
    )`);
  }

  const types = typeList(options.types ?? options.type);
  if (types.length > 0) conditions.push(inArray(Unit.type, types as never));
  else conditions.push(ne(Unit.type, "LABEL"));

  const excludeTypes = typeList(options.excludeTypes);
  if (excludeTypes.length > 0) {
    conditions.push(notInArray(Unit.type, excludeTypes as never));
  }

  const statuses = typeList(options.statuses ?? options.status);
  if (statuses.length > 0) {
    conditions.push(inArray(Unit.status, statuses as never));
  }

  if (options.visibility?.trim()) {
    conditions.push(eq(Unit.visibility, options.visibility as never));
  }

  const userIds = typeList(options.userIds ?? options.userId);
  if (userIds.length > 0) conditions.push(inArray(Unit.userId, userIds));

  if (options.catalogEntryKind !== undefined) {
    conditions.push(
      options.catalogEntryKind === null
        ? isNull(Unit.catalogEntryKind)
        : eq(Unit.catalogEntryKind, options.catalogEntryKind as never),
    );
  }

  if (options.targetUnitId !== undefined) {
    conditions.push(
      options.targetUnitId === null
        ? isNull(Unit.targetUnitId)
        : eq(Unit.targetUnitId, options.targetUnitId),
    );
  }

  if (options.language?.trim()) {
    conditions.push(sql`EXISTS (
      SELECT 1 FROM "UnitTranslation" tr
      WHERE tr."unitId" = ${Unit.id}
        AND tr."language" = ${options.language}
    )`);
  }

  const readLanguages = resolveEffectiveReadLanguageCandidates({
    languages: (options as { languages?: string | readonly string[] })
      .languages,
    appLocale: (options as { appLocale?: string }).appLocale,
  });
  if (options.languageMode === "preferred" && readLanguages.length > 0) {
    conditions.push(
      or(
        eq(Unit.isLanguageNeutral, true),
        sql`EXISTS (
          SELECT 1 FROM "UnitSupportLanguage" lang
          WHERE lang."unitId" = ${Unit.id}
            AND lang."language" IN ${readLanguages}
        )`,
      ),
    );
  }

  if (options.rating) conditions.push(eq(Unit.rating, options.rating as never));
  if (options.createdAtFrom) {
    conditions.push(gte(Unit.createdAt, new Date(options.createdAtFrom)));
  }
  if (options.createdAtTo) {
    conditions.push(lte(Unit.createdAt, new Date(options.createdAtTo)));
  }
  if (options.publishedAtFrom) {
    conditions.push(gte(Unit.publishedAt, new Date(options.publishedAtFrom)));
  }
  if (options.publishedAtTo) {
    conditions.push(lte(Unit.publishedAt, new Date(options.publishedAtTo)));
  }
  const ids = parseIdsCsv(options.ids);
  if (ids && ids.length > 0) conditions.push(inArray(Unit.id, ids));

  return conditions;
}

function createDrizzleUnitRepository(): UnitRepository {
  return {
    async list(options) {
      const db = await getServerDb();
      const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
      const skipNum = options.cursor?.unitId ? 1 : (options.start ?? 0);
      const sortField =
        options.sort?.field && options.sort.field in Unit
          ? (Unit as unknown as Record<string, any>)[options.sort.field]
          : Unit.createdAt;
      const sortOrder =
        options.sort?.order?.toLowerCase() === "asc" ? "asc" : "desc";
      const conditions = createUnitListConditions(options);
      if (options.cursor?.unitId) {
        conditions.push(eq(Unit.id, options.cursor.unitId));
      }
      const where = conditions.length > 0 ? and(...conditions) : undefined;

      const [unitRows, totalRows] = await Promise.all([
        db
          .select({ id: Unit.id })
          .from(Unit)
          .where(where)
          .orderBy(sortOrder === "asc" ? sortField : desc(sortField))
          .offset(skipNum)
          .limit(limitNum),
        db.select({ value: count() }).from(Unit).where(where),
      ]);

      const units = await Promise.all(
        unitRows.map((row) => hydrateUnitOrThrow(db, row.id)),
      );
      return {
        units: await hydrateUnitOwnerUserSlugs(units),
        total: totalRows[0]?.value ?? 0,
      };
    },
    async getByUnitId(unitId) {
      const db = await getServerDb();
      return hydrateUnitOwnerUserSlugRow(await hydrateUnitOrThrow(db, unitId));
    },
    async create(input) {
      const db = await getServerDb();
      const unitId = await db.transaction(async (tx) => {
        const now = new Date();
        const type = input.type;
        const unitValues: typeof Unit.$inferInsert = {
          userId: input.userId ?? null,
          type: type as typeof Unit.$inferInsert.type,
          slugScope: pickSlugScope(type as never, input.userId),
          status: (input.status ?? "DRAFT") as typeof Unit.$inferInsert.status,
          visibility: (input.visibility ??
            "PUBLIC") as typeof Unit.$inferInsert.visibility,
          isLanguageNeutral: input.isLanguageNeutral ?? false,
          rating: (input.rating ??
            "GENERAL") as typeof Unit.$inferInsert.rating,
          aiDisclosureMode: (input.aiDisclosureMode ??
            "UNKNOWN") as typeof Unit.$inferInsert.aiDisclosureMode,
          aiDisclosureDetails:
            input.aiDisclosureDetails === undefined
              ? null
              : (input.aiDisclosureDetails ?? null),
          licenseSlug: assertLicenseSlug(input.licenseSlug) ?? null,
          catalogEntryKind: catalogEntryKindValue(
            input.catalogEntryKind,
          ) as typeof Unit.$inferInsert.catalogEntryKind,
          targetUnitId:
            input.targetUnitId === undefined ? null : input.targetUnitId,
          extra: input.extra ?? null,
          publishedAt: input.publishedAt
            ? new Date(input.publishedAt as never)
            : null,
          updatedAt: now,
        };
        const [unit] = await tx
          .insert(Unit)
          .values(unitValues)
          .returning({ id: Unit.id });
        if (!unit) throw new Error("Failed to create Unit");

        if (input.translations && input.translations.length > 0) {
          for (const tr of input.translations) {
            assertUnitTranslationExtraAllowed(tr.extra ?? null);
          }
          await tx.insert(UnitTranslation).values(
            input.translations.map((tr) => ({
              unitId: unit.id,
              language: tr.language,
              title: tr.title ?? null,
              subtitle: tr.subtitle ?? null,
              summary: tr.summary ?? null,
              description: nullableContentDocJson(tr.description),
              extra: tr.extra ?? null,
              sourceUnitId: tr.sourceUnitId ?? null,
              updatedAt: now,
            })),
          );
          await tx.insert(UnitSupportLanguage).values({
            unitId: unit.id,
            ...primarySupportLanguageCreate(input.translations[0]!.language),
          });
        }

        return unit.id;
      });
      return hydrateUnitOwnerUserSlugRow(await hydrateUnitOrThrow(db, unitId));
    },
    async update(unitId, input) {
      const db = await getServerDb();
      await db
        .update(Unit)
        .set({
          ...(input.status !== undefined && { status: input.status as never }),
          ...(input.visibility !== undefined && {
            visibility: input.visibility as never,
          }),
          ...(input.rating !== undefined && { rating: input.rating as never }),
          ...(input.aiDisclosureMode !== undefined && {
            aiDisclosureMode: input.aiDisclosureMode as never,
          }),
          ...(input.aiDisclosureDetails !== undefined && {
            aiDisclosureDetails: input.aiDisclosureDetails ?? null,
          }),
          ...(input.licenseSlug !== undefined && {
            licenseSlug:
              input.licenseSlug === null
                ? null
                : (assertLicenseSlug(input.licenseSlug) ?? null),
          }),
          ...(input.catalogEntryKind !== undefined && {
            catalogEntryKind: catalogEntryKindValue(
              input.catalogEntryKind,
            ) as never,
          }),
          ...(input.targetUnitId !== undefined && {
            targetUnitId: input.targetUnitId,
          }),
          ...(input.isLanguageNeutral !== undefined && {
            isLanguageNeutral: input.isLanguageNeutral,
          }),
          ...(input.extra !== undefined && { extra: input.extra }),
          ...(input.publishedAt !== undefined && {
            publishedAt: input.publishedAt
              ? new Date(input.publishedAt as never)
              : null,
          }),
          updatedAt: new Date(),
        })
        .where(eq(Unit.id, unitId));
      return hydrateUnitOwnerUserSlugRow(await hydrateUnitOrThrow(db, unitId));
    },
    async getBySlug({ slugScope, slug }) {
      const db = await getServerDb();
      const [unit] = await db
        .select({ id: Unit.id })
        .from(Unit)
        .where(and(eq(Unit.slugScope, slugScope), eq(Unit.slug, slug)))
        .limit(1);
      return unit
        ? hydrateUnitOwnerUserSlugRow(await hydrateUnitOrThrow(db, unit.id))
        : null;
    },
    async setSlug(unitId, slug) {
      const db = await getServerDb();
      await db
        .update(Unit)
        .set({ slug, updatedAt: new Date() })
        .where(eq(Unit.id, unitId));
      return hydrateUnitOwnerUserSlugRow(await hydrateUnitOrThrow(db, unitId));
    },
    async delete(unitId) {
      const db = await getServerDb();
      await db.delete(Unit).where(eq(Unit.id, unitId));
    },
  };
}

/**
 * Unit Service - Business logic for generic Unit entities
 * Unit Service —— 通用 Unit 实体的业务逻辑
 */
export class UnitService {
  constructor(
    private readonly repository: UnitRepository = createDrizzleUnitRepository(),
  ) {}

  /**
   * List Units with pagination and rich filters.
   * 以分页和丰富的过滤条件列出 Unit。
   */
  async list(
    options: UnitListQuery = {},
  ): Promise<{ units: UnitWithRelations[]; total: number }> {
    return this.repository.list(options);
  }

  /** Get a unit by id with relations. 按 id 获取 unit 及其关联数据。 */
  async getByUnitId(unitId: string): Promise<UnitWithRelations> {
    return this.repository.getByUnitId(unitId);
  }

  /** Create a Unit with optional translations. 创建 Unit，可选附带译文。 */
  async create(input: CreateUnitInput): Promise<UnitWithRelations> {
    const unit = await this.repository.create(input);
    await enqueueContentCommand(SEARCH_COMMAND_KINDS.contentSync, unit.id);
    return unit;
  }

  /**
   * Update a Unit (does not touch translations -- use TranslationService).
   *
   * Unit rating is independent per unit -- a chapter may rate higher than its
   * book; no parent/child rating constraint is enforced, by design
   * (chapter-level moderation).
   *
   * 更新 Unit（不涉及译文 —— 请使用 TranslationService）。
   *
   * Unit 的评级按 unit 独立计算 —— 某一章节的评级可能高于其所属书籍；按设计不
   * 强制任何父子评级约束（章节级审核）。
   */
  async update(
    unitId: string,
    input: UpdateUnitInput,
  ): Promise<UnitWithRelations> {
    const unit = await this.repository.update(unitId, input);

    const patchFields: Record<string, any> = {};
    if (input.rating !== undefined) patchFields.rating = input.rating;
    if (input.aiDisclosureMode !== undefined)
      patchFields.aiDisclosureMode = input.aiDisclosureMode;
    if (input.visibility !== undefined)
      patchFields.visibility = input.visibility;
    if (input.licenseSlug !== undefined)
      patchFields.licenseSlug = input.licenseSlug;
    if (input.catalogEntryKind !== undefined)
      patchFields.catalogEntryKind = input.catalogEntryKind;
    if (input.targetUnitId !== undefined)
      patchFields.targetUnitId = input.targetUnitId;
    if (input.publishedAt !== undefined) {
      patchFields.publishedAt = input.publishedAt
        ? new Date(input.publishedAt as never).toISOString()
        : null;
    }
    await enqueueContentMetadataCommand(unitId, patchFields);

    return unit;
  }

  /**
   * Get a unit by `(scope, slug)`. `scope` is either a named scope key
   * (`user|realm|tag|zone|entity`) or an owner unit id.
   * 按 `(scope, slug)` 获取 unit。`scope` 可以是具名作用域键
   * (`user|realm|tag|zone|entity`)，也可以是归属者的 unit id。
   */
  async getBySlug(
    scope: string,
    slug: string,
  ): Promise<UnitWithRelations | null> {
    const { resolveScopeId } = await import("@/shared/slug-ref");
    const slugScope = resolveScopeId(scope);
    if (!slugScope) return null;
    return this.repository.getBySlug({ slugScope, slug });
  }

  /** Set or update a unit's slug. 设置或更新 unit 的 slug。 */
  async setSlug(unitId: string, slug: string): Promise<UnitWithRelations> {
    return this.repository.setSlug(unitId, slug);
  }

  /** Delete a Unit by id (cascades). 按 id 删除 Unit（级联删除）。 */
  async delete(unitId: string): Promise<void> {
    await this.repository.delete(unitId);
    await enqueueContentCommand(SEARCH_COMMAND_KINDS.contentDelete, unitId);
    cleanupReactions(unitId).catch(() => {});
  }
}

export const unitService = new UnitService();
