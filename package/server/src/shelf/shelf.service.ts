import type {
  AddShelfUnitInput,
  CreateShelfInput,
  ReorderShelfUnitInput,
  SeedTagName,
  SetPinnedTagsResponse,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfListQuery,
  ShelfMatchedUnitDTO,
  ShelfSummaryDTO,
  ShelfUnitBatchOp,
  ShelfUnitBatchResult,
  ShelfUnitDTO,
  ShelfUnitKind,
  ShelfUnitRelationDTO,
  ShelfUnitRelationRole,
  ShelfUnitsQuery,
  ShelfUnitsResponse,
  UpdateShelfInput,
} from "@rezics/contract";
import { parseIdsCsv, SEED_TAG_NAMES, withCoverUrl } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import {
  and,
  asc,
  count,
  desc,
  eq,
  inArray,
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import { nullableContentDocJson } from "@/content-doc/json-write";
import { getSeedTagId } from "@/infra/seed-tags";
import { serverJobProducer } from "@/job/job-boundary";
import { searchClient } from "@/meili/search-client";
import { assertLicenseSlug } from "@/unit/publication-policy";
import { hydrateVariantContextSummaries } from "@/unit/variant-context";
import { AppError } from "@/utils/errors";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import {
  Post,
  Shelf,
  ShelfUnit,
  ShelfUnitRelation,
  Unit,
  UnitTag,
  UnitTranslation,
  User,
  UserTagApplication,
  UserUnitCollection,
} from "../db/schema";
import {
  generateBetween,
  POSITION_LENGTH_THRESHOLD,
  rebalance,
} from "./fractional-index";
import { enqueueUserUnitCollectionSearchSync } from "./user-unit-collection.service";

export const SHELF_ITEM_BATCH_OP_CAP = 200;

import {
  mapShelfDetailToDTO,
  mapShelfListRowToDTO,
  mapShelfSummaryToDTO,
  mapShelfToDTO,
  mapShelfUnitRelationToDTO,
  mapShelfUnitToDTO,
  mapShelfUnitToDTOWithVariantContext,
} from "./shelf.mapper";
import { isSystemKindKey } from "./system-shelves";

const REBALANCE_WINDOW = 50;
const SHELF_SEARCH_HIT_LIMIT = 1000;

export async function enqueueContainedUnitIdsSync(
  shelfId: string,
): Promise<void> {
  await serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchContainedUnitIds,
      { unitId: shelfId },
      { type: "server", service: "shelf" },
    ),
  );
}

type DbLike = any;

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function nextShelfPosition(tx: DbLike, shelfId: string): Promise<string> {
  const [last] = await tx
    .select({ position: ShelfUnit.position })
    .from(ShelfUnit)
    .where(eq(ShelfUnit.shelfId, shelfId))
    .orderBy(desc(ShelfUnit.position))
    .limit(1);
  return generateBetween(last?.position, undefined);
}

async function ensureShelfUnit(
  tx: DbLike,
  shelfId: string,
  unitId: string,
  kind: ShelfUnitKind,
  variantUnitId?: string | null,
  explicitPosition?: string,
): Promise<{ created: boolean }> {
  const position = explicitPosition ?? (await nextShelfPosition(tx, shelfId));
  const created = await tx
    .insert(ShelfUnit)
    .values({
      shelfId,
      unitId,
      variantUnitId: variantUnitId ?? null,
      kind,
      position,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ unitId: ShelfUnit.unitId });
  if (created.length === 0 && variantUnitId !== undefined) {
    await tx
      .update(ShelfUnit)
      .set({ variantUnitId, updatedAt: new Date() })
      .where(and(eq(ShelfUnit.shelfId, shelfId), eq(ShelfUnit.unitId, unitId)));
  }
  if (created.length > 0) {
    await tx
      .update(Shelf)
      .set({
        itemCount: sql`${Shelf.itemCount} + ${created.length}`,
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, shelfId));
  }
  return { created: created.length > 0 };
}

async function deleteShelfUnit(
  tx: DbLike,
  shelfId: string,
  unitId: string,
): Promise<number> {
  const deleted = await tx
    .delete(ShelfUnit)
    .where(and(eq(ShelfUnit.shelfId, shelfId), eq(ShelfUnit.unitId, unitId)))
    .returning({ unitId: ShelfUnit.unitId });
  if (deleted.length > 0) {
    await tx
      .update(Shelf)
      .set({
        itemCount: sql`${Shelf.itemCount} - ${deleted.length}`,
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, shelfId));
  }
  return deleted.length;
}

async function applyCollectionMetadataDrizzle(
  tx: DbLike,
  userId: string,
  unitId: string,
  patch: Pick<AddShelfUnitInput, "tagUnitIds" | "searchText">,
): Promise<void> {
  if (patch.searchText !== undefined) {
    await tx
      .insert(UserUnitCollection)
      .values({
        userId,
        unitId,
        searchText: patch.searchText,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [UserUnitCollection.userId, UserUnitCollection.unitId],
        set: { searchText: patch.searchText, updatedAt: new Date() },
      });
  }

  if (patch.tagUnitIds !== undefined) {
    await tx
      .delete(UserTagApplication)
      .where(
        and(
          eq(UserTagApplication.userId, userId),
          eq(UserTagApplication.unitId, unitId),
        ),
      );

    const tagUnitIds = Array.from(
      new Set(patch.tagUnitIds.map((id) => id.trim()).filter(Boolean)),
    );
    if (tagUnitIds.length > 0) {
      await tx.insert(UserTagApplication).values(
        tagUnitIds.map((tagUnitId, index) => ({
          userId,
          unitId,
          tagUnitId,
          position: String(index).padStart(8, "0"),
          updatedAt: new Date(),
        })),
      );
    }
  }
}

async function findShelfUnit(tx: DbLike, shelfId: string, unitId: string) {
  const [row] = await tx
    .select()
    .from(ShelfUnit)
    .where(and(eq(ShelfUnit.shelfId, shelfId), eq(ShelfUnit.unitId, unitId)))
    .limit(1);
  return row ?? null;
}

async function upsertShelfUnitRelation(
  tx: DbLike,
  input: {
    shelfId: string;
    parentUnitId: string;
    childUnitId: string;
    role: ShelfUnitRelationRole;
  },
) {
  await tx.insert(ShelfUnitRelation).values(input).onConflictDoNothing();
  const [row] = await tx
    .select()
    .from(ShelfUnitRelation)
    .where(
      and(
        eq(ShelfUnitRelation.shelfId, input.shelfId),
        eq(ShelfUnitRelation.parentUnitId, input.parentUnitId),
        eq(ShelfUnitRelation.childUnitId, input.childUnitId),
        eq(ShelfUnitRelation.role, input.role),
      ),
    )
    .limit(1);
  if (!row) throw new Error("ShelfUnitRelation not found");
  return row;
}

async function deleteShelfUnitRelations(
  tx: DbLike,
  input: {
    shelfId: string;
    parentUnitId?: string;
    childUnitId?: string;
    childUnitIds?: string[];
    role?: ShelfUnitRelationRole;
  },
) {
  return tx
    .delete(ShelfUnitRelation)
    .where(
      and(
        eq(ShelfUnitRelation.shelfId, input.shelfId),
        input.parentUnitId
          ? eq(ShelfUnitRelation.parentUnitId, input.parentUnitId)
          : undefined,
        input.childUnitId
          ? eq(ShelfUnitRelation.childUnitId, input.childUnitId)
          : undefined,
        input.childUnitIds?.length
          ? inArray(ShelfUnitRelation.childUnitId, input.childUnitIds)
          : undefined,
        input.role ? eq(ShelfUnitRelation.role, input.role) : undefined,
      ),
    );
}

function getSeedTagIdSet(): Set<string> {
  const ids = new Set<string>();
  for (const name of SEED_TAG_NAMES as readonly SeedTagName[]) {
    const id = getSeedTagId(name);
    if (id) ids.add(id);
  }
  return ids;
}

function assertOnlySeedTags(ids: readonly string[]): void {
  if (ids.length === 0) return;
  const allowed = getSeedTagIdSet();
  for (const id of ids) {
    if (!allowed.has(id)) {
      throw new AppError(400, "invalid-pin-target");
    }
  }
}

const publicUserColumns = {
  unitId: User.unitId,
  name: User.name,
  avatar: User.avatar,
  bio: User.bio,
  description: User.description,
  followersCount: User.followersCount,
  followingsCount: User.followingsCount,
};

async function hydrateShelfWithMetadata(
  unitId: string,
  dbLike?: DbLike,
): Promise<any> {
  const db = dbLike ?? (await getServerDb());
  const [shelf] = await db
    .select()
    .from(Shelf)
    .where(eq(Shelf.unitId, unitId))
    .limit(1);
  if (!shelf) throw new Error(`Shelf not found: ${unitId}`);
  const [unit] = await db
    .select()
    .from(Unit)
    .where(eq(Unit.id, unitId))
    .limit(1);
  if (!unit) throw new Error(`Shelf Unit not found: ${unitId}`);
  const [translations, unitTags, users] = await Promise.all([
    db.select().from(UnitTranslation).where(eq(UnitTranslation.unitId, unitId)),
    db
      .select()
      .from(UnitTag)
      .where(eq(UnitTag.unitId, unitId))
      .orderBy(desc(UnitTag.score)),
    unit.userId
      ? db
          .select(publicUserColumns)
          .from(User)
          .where(eq(User.unitId, unit.userId))
          .limit(1)
      : Promise.resolve([]),
  ]);
  return {
    ...shelf,
    unit: {
      ...unit,
      user: users[0] ?? null,
      translations,
      unitTags,
    },
  };
}

async function hydrateShelfRows(unitIds: readonly string[]): Promise<any[]> {
  return Promise.all(unitIds.map((unitId) => hydrateShelfWithMetadata(unitId)));
}

export class ShelfService {
  private async resolveShelfUnitSearchIds(
    shelfId: string,
    query: ShelfUnitsQuery,
    viewerUserId?: string | null,
  ): Promise<Set<string> | null> {
    const q = query.q?.trim();
    const tagUnitIds = Array.from(
      new Set((query.tagUnitIds ?? []).map((id) => id.trim()).filter(Boolean)),
    );
    if (!q && tagUnitIds.length === 0) return null;

    const db = await getServerDb();
    const [shelf] = await db
      .select({ userId: Unit.userId })
      .from(Shelf)
      .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
      .where(eq(Shelf.unitId, shelfId))
      .limit(1);
    const ownerUserId = shelf?.userId;
    if (!ownerUserId) return new Set();

    let allowedIds: Set<string> | null = null;

    if (q) {
      const [contentResp, collectionResp] = await Promise.all([
        searchClient.contentIndex.search(q, {
          limit: SHELF_SEARCH_HIT_LIMIT,
          attributesToRetrieve: ["id"],
        }),
        viewerUserId === ownerUserId
          ? searchClient.collectionIndex.search(q, {
              limit: SHELF_SEARCH_HIT_LIMIT,
              filter: `ownerUserId = "${ownerUserId}"`,
              attributesToRetrieve: ["unitId"],
            })
          : Promise.resolve({ hits: [] as any[] }),
      ]);

      allowedIds = new Set([
        ...(contentResp.hits as any[])
          .map((hit) => hit.id)
          .filter((id): id is string => typeof id === "string"),
        ...(collectionResp.hits as any[])
          .map((hit) => hit.unitId)
          .filter((id): id is string => typeof id === "string"),
      ]);
    }

    if (tagUnitIds.length > 0) {
      const tagRows = await db
        .select({
          unitId: UserTagApplication.unitId,
          tagUnitId: UserTagApplication.tagUnitId,
        })
        .from(UserTagApplication)
        .where(
          and(
            eq(UserTagApplication.userId, ownerUserId),
            inArray(UserTagApplication.tagUnitId, tagUnitIds),
          ),
        );
      const tagsByUnitId = new Map<string, Set<string>>();
      for (const row of tagRows) {
        const set = tagsByUnitId.get(row.unitId) ?? new Set<string>();
        set.add(row.tagUnitId);
        tagsByUnitId.set(row.unitId, set);
      }
      const taggedIds = new Set(
        [...tagsByUnitId.entries()]
          .filter(([, tags]) => tagUnitIds.every((tagId) => tags.has(tagId)))
          .map(([unitId]) => unitId),
      );
      allowedIds = allowedIds
        ? new Set([...allowedIds].filter((unitId) => taggedIds.has(unitId)))
        : taggedIds;
    }

    return allowedIds ?? null;
  }

  private buildWhere(options: ShelfListQuery): SQL | undefined {
    const conditions: SQL[] = [
      eq(Unit.type, "SHELF"),
      eq(Unit.status, "PUBLISHED"),
      eq(Unit.visibility, "PUBLIC"),
      eq(Unit.moderationStatus, "APPROVED"),
    ];

    if (options.userId?.trim()) {
      conditions.push(eq(Unit.userId, options.userId));
    }

    if (options.kindKey?.trim()) {
      conditions.push(eq(Shelf.kindKey, options.kindKey));
    }

    const containsUnitId = options.containsUnitId?.trim();
    if (containsUnitId) {
      conditions.push(sql`exists (
        select 1 from "ShelfUnit" su
        where su."shelfId" = ${Shelf.unitId}
          and su."unitId" = ${containsUnitId}
      )`);
    }

    const variantUnitId = options.variantUnitId?.trim();
    if (variantUnitId) {
      conditions.push(sql`exists (
        select 1 from "ShelfUnit" su
        where su."shelfId" = ${Shelf.unitId}
          and su."variantUnitId" = ${variantUnitId}
      )`);
    }

    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      conditions.push(inArray(Shelf.unitId, idList));
    }

    return and(...conditions);
  }

  private buildOrderBy(options: ShelfListQuery): [SQL, SQL] {
    const order = (options.sort?.order ?? "desc") as "asc" | "desc";
    const direction = order === "asc" ? asc : desc;
    const field = options.sort?.field ?? "createdAt";
    return [
      direction(field === "updatedAt" ? Unit.updatedAt : Unit.createdAt),
      desc(Shelf.unitId),
    ];
  }

  async list(
    options: ShelfListQuery = {},
  ): Promise<{ shelves: ShelfDTO[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const hasCursor = Boolean(options.cursor?.unitId);
    const skipNum = hasCursor ? 1 : (options.start ?? 0);
    const where = this.buildWhere(options);
    const orderBy = this.buildOrderBy(options);
    const db = await getServerDb();

    const [rows, totalRows] = await Promise.all([
      db
        .select({ unitId: Shelf.unitId })
        .from(Shelf)
        .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
        .where(where)
        .orderBy(...orderBy)
        .offset(skipNum)
        .limit(limitNum),
      db
        .select({ total: count() })
        .from(Shelf)
        .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
        .where(where),
    ]);

    const hydratedRows = await hydrateUnitOwnerUserSlugs(
      await hydrateShelfRows(rows.map((row) => row.unitId)),
    );
    const matchedByShelfId = await this.getMatchedUnitsByShelfId(
      hydratedRows.map((row) => row.unitId),
      {
        containsUnitId: options.containsUnitId?.trim(),
        variantUnitId: options.variantUnitId?.trim(),
      },
    );
    return {
      shelves: hydratedRows.map((row) =>
        mapShelfListRowToDTO(row, matchedByShelfId.get(row.unitId)),
      ),
      total: totalRows[0]?.total ?? 0,
    };
  }

  private async getMatchedUnitsByShelfId(
    shelfIds: string[],
    filters: {
      containsUnitId?: string;
      variantUnitId?: string;
    },
  ): Promise<Map<string, ShelfMatchedUnitDTO>> {
    const out = new Map<string, ShelfMatchedUnitDTO>();
    if (shelfIds.length === 0) return out;

    const containsUnitId = filters.containsUnitId?.trim();
    const variantUnitId = filters.variantUnitId?.trim();
    if (!containsUnitId && !variantUnitId) return out;

    const db = await getServerDb();
    const shelfUnits = await db
      .select({
        shelfId: ShelfUnit.shelfId,
        unitId: ShelfUnit.unitId,
        variantUnitId: ShelfUnit.variantUnitId,
        kind: ShelfUnit.kind,
      })
      .from(ShelfUnit)
      .where(
        and(
          inArray(ShelfUnit.shelfId, shelfIds),
          containsUnitId ? eq(ShelfUnit.unitId, containsUnitId) : undefined,
          variantUnitId
            ? eq(ShelfUnit.variantUnitId, variantUnitId)
            : undefined,
        ),
      )
      .orderBy(asc(ShelfUnit.position));

    const matchedUnitIds = [
      ...new Set(shelfUnits.map((row) => row.variantUnitId ?? row.unitId)),
    ];
    const units =
      matchedUnitIds.length > 0
        ? await db
            .select({
              id: Unit.id,
              defaultLanguage: Unit.defaultLanguage,
              language: UnitTranslation.language,
              title: UnitTranslation.title,
            })
            .from(Unit)
            .leftJoin(UnitTranslation, eq(Unit.id, UnitTranslation.unitId))
            .where(inArray(Unit.id, matchedUnitIds))
        : [];
    const unitById = new Map<
      string,
      {
        defaultLanguage: string | null;
        translations: Array<{ language: string | null; title: string | null }>;
      }
    >();
    for (const unit of units) {
      const current = unitById.get(unit.id) ?? {
        defaultLanguage: unit.defaultLanguage,
        translations: [],
      };
      if (unit.language) {
        current.translations.push({
          language: unit.language,
          title: unit.title,
        });
      }
      unitById.set(unit.id, current);
    }

    for (const row of shelfUnits) {
      if (out.has(row.shelfId)) continue;
      const matchedUnitId = row.variantUnitId ?? row.unitId;
      const unit = unitById.get(matchedUnitId);
      const translations = unit?.translations ?? [];
      const title =
        translations.find((tr) => tr.language === unit?.defaultLanguage)
          ?.title ??
        translations[0]?.title ??
        null;
      out.set(row.shelfId, {
        unitId: matchedUnitId,
        kind: row.kind as ShelfMatchedUnitDTO["kind"],
        title,
      });
    }

    return out;
  }

  async listUserShelves(userId: string): Promise<ShelfSummaryDTO[]> {
    const db = await getServerDb();
    const rows = await db
      .select({ unitId: Shelf.unitId })
      .from(Shelf)
      .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
      .where(and(eq(Unit.userId, userId), eq(Unit.type, "SHELF")))
      .orderBy(asc(Shelf.createdAt));
    return (
      await hydrateUnitOwnerUserSlugs(
        await hydrateShelfRows(rows.map((row) => row.unitId)),
      )
    ).map(mapShelfSummaryToDTO);
  }

  async getByUnitId(unitId: string): Promise<ShelfDetailDTO> {
    const row = await hydrateShelfWithMetadata(unitId);
    return mapShelfDetailToDTO(
      await hydrateUnitOwnerUserSlugRow(row),
      row.itemCount,
    );
  }

  /**
   * Resolve `{ ownerUserId, slug }` under the owner scope. Only system shelf
   * slugs ('favorites' | 'backlog' | 'active' | 'completed') are accepted in
   * v1 — every other slug returns null per `SHELF_CUSTOM_SLUG_DISABLED`.
   *
   * Lookup goes through the Unit slug index `(slugScope = ownerUserId,
   * slug)` so the resolver shares the path used by every other slug-bearing
   * Unit.
   */
  async getByOwnerAndSlug(
    ownerUserId: string,
    slug: string,
  ): Promise<ShelfDetailDTO | null> {
    if (!isSystemKindKey(slug)) return null;
    const db = await getServerDb();
    const [unit] = await db
      .select({ id: Unit.id })
      .from(Unit)
      .where(
        and(
          eq(Unit.type, "SHELF"),
          eq(Unit.slug, slug),
          eq(Unit.slugScope, ownerUserId),
        ),
      )
      .limit(1);
    if (!unit) return null;
    const row = await hydrateShelfWithMetadata(unit.id);
    return mapShelfDetailToDTO(
      await hydrateUnitOwnerUserSlugRow(row),
      row.itemCount,
    );
  }

  async create(req: CreateShelfInput, userId: string): Promise<ShelfDTO> {
    const {
      title,
      kindKey,
      coverUrl,
      visibility,
      tagIds,
      extra,
      translations,
    } = req;

    if (isSystemKindKey(kindKey)) {
      throw new AppError(
        400,
        `kindKey '${kindKey}' is reserved for system shelves`,
      );
    }

    // v1 rejects any client-supplied slug for user-created shelves
    // (schema-enforced) — system shelves only. Custom slugs are a deliberate
    // future toggle, not an oversight. Guard against any payload that smuggles
    // a `slug` field (SHELF_CUSTOM_SLUG_DISABLED).
    if ((req as Record<string, unknown>).slug != null) {
      throw new AppError(
        400,
        "Custom shelf slugs are disabled (SHELF_CUSTOM_SLUG_DISABLED).",
      );
    }

    if (tagIds?.length) {
      assertOnlySeedTags(tagIds);
    }

    const baseTranslations = translations?.length
      ? translations
      : title || coverUrl !== undefined
        ? [
            {
              language: "en" as const,
              title,
              subtitle: undefined,
              summary: undefined,
              description: undefined,
            },
          ]
        : [];

    const defaultLanguage = baseTranslations[0]?.language ?? "en";
    const translationData = baseTranslations.map((tr) => {
      const nextExtra =
        coverUrl !== undefined && tr.language === defaultLanguage
          ? withCoverUrl(undefined, coverUrl ?? undefined)
          : undefined;
      return {
        language: tr.language,
        title: tr.title,
        subtitle: tr.subtitle,
        summary: tr.summary,
        description: nullableContentDocJson(tr.description),
        ...(nextExtra !== undefined ? { extra: nextExtra } : {}),
      };
    });

    const db = await getServerDb();
    const [unit] = await db
      .insert(Unit)
      .values({
        userId,
        slugScope: userId,
        type: "SHELF",
        status: "PUBLISHED",
        visibility: (visibility ??
          "PUBLIC") as typeof Unit.$inferInsert.visibility,
        licenseSlug: assertLicenseSlug(req.licenseSlug) ?? undefined,
        updatedAt: new Date(),
      })
      .returning({ id: Unit.id });
    if (!unit) throw new Error("Failed to create shelf Unit");

    if (translationData.length > 0) {
      await db.insert(UnitTranslation).values(
        translationData.map((tr) => ({
          unitId: unit.id,
          language: tr.language,
          ...(tr.title !== undefined ? { title: tr.title } : {}),
          ...(tr.subtitle !== undefined ? { subtitle: tr.subtitle } : {}),
          ...(tr.summary !== undefined ? { summary: tr.summary } : {}),
          ...(tr.description !== undefined
            ? { description: tr.description }
            : {}),
          ...(tr.extra !== undefined ? { extra: tr.extra } : {}),
        })) as Array<typeof UnitTranslation.$inferInsert>,
      );
    }
    if (tagIds?.length) {
      await db.insert(UnitTag).values(
        tagIds.map((tagUnitId) => ({
          unitId: unit.id,
          tagUnitId,
          score: 0,
          voteCount: 0,
          pinned: true,
          updatedAt: new Date(),
        })),
      );
    }

    await db.insert(Shelf).values({
      unitId: unit.id,
      ...(kindKey !== undefined ? { kindKey } : {}),
      ...(extra !== undefined ? { extra: extra ?? null } : {}),
      updatedAt: new Date(),
    });

    const row = await hydrateShelfWithMetadata(unit.id, db);
    return mapShelfToDTO(await hydrateUnitOwnerUserSlugRow(row));
  }

  async update(unitId: string, req: UpdateShelfInput): Promise<ShelfDTO> {
    if ((req as Record<string, unknown>).slug !== undefined) {
      throw new AppError(
        400,
        "Custom shelf slugs are disabled (SHELF_CUSTOM_SLUG_DISABLED).",
      );
    }
    const { kindKey, coverUrl, visibility, extra, title } = req;
    const db = await getServerDb();

    if (visibility !== undefined || req.licenseSlug !== undefined) {
      await db
        .update(Unit)
        .set({
          ...(visibility !== undefined
            ? { visibility: visibility as typeof Unit.$inferInsert.visibility }
            : {}),
          licenseSlug:
            req.licenseSlug === null
              ? null
              : (assertLicenseSlug(req.licenseSlug) ?? undefined),
          updatedAt: new Date(),
        })
        .where(eq(Unit.id, unitId));
    }

    if (title !== undefined || coverUrl !== undefined) {
      const [unit] = await db
        .select({ defaultLanguage: Unit.defaultLanguage })
        .from(Unit)
        .where(eq(Unit.id, unitId))
        .limit(1);
      if (!unit) throw new Error(`Unit not found: ${unitId}`);
      const language = unit.defaultLanguage ?? "en";
      const [existing] = await db
        .select({ extra: UnitTranslation.extra })
        .from(UnitTranslation)
        .where(
          and(
            eq(UnitTranslation.unitId, unitId),
            eq(UnitTranslation.language, language),
          ),
        )
        .limit(1);
      const nextExtra =
        coverUrl !== undefined
          ? (withCoverUrl(
              existing?.extra ?? undefined,
              coverUrl ?? undefined,
            ) as unknown)
          : undefined;
      await db
        .insert(UnitTranslation)
        .values({
          unitId,
          language,
          ...(title !== undefined ? { title } : {}),
          ...(nextExtra !== undefined ? { extra: nextExtra } : {}),
        } as typeof UnitTranslation.$inferInsert)
        .onConflictDoUpdate({
          target: [UnitTranslation.unitId, UnitTranslation.language],
          set: {
            ...(title !== undefined ? { title } : {}),
            ...(nextExtra !== undefined ? { extra: nextExtra } : {}),
          },
        });
    }

    const [updated] = await db
      .update(Shelf)
      .set({
        ...(kindKey !== undefined ? { kindKey } : {}),
        ...(extra !== undefined ? { extra: extra ?? null } : {}),
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, unitId))
      .returning({ unitId: Shelf.unitId });
    if (!updated) throw new Error(`Shelf not found: ${unitId}`);

    const row = await hydrateShelfWithMetadata(unitId, db);
    return mapShelfToDTO(await hydrateUnitOwnerUserSlugRow(row));
  }

  async delete(unitId: string): Promise<void> {
    const db = await getServerDb();
    await db.delete(Unit).where(eq(Unit.id, unitId));
  }

  async setPinnedTags(
    shelfUnitId: string,
    pinnedTagIds: readonly string[],
    actorUserId: string,
  ): Promise<SetPinnedTagsResponse> {
    const db = await getServerDb();
    const [shelf] = await db
      .select({ userId: Unit.userId })
      .from(Shelf)
      .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
      .where(eq(Shelf.unitId, shelfUnitId))
      .limit(1);
    if (!shelf) {
      throw new AppError(404, `Shelf not found: ${shelfUnitId}`);
    }
    if (shelf.userId !== actorUserId) {
      throw new AppError(
        403,
        "Forbidden: you do not have permission to update this shelf",
      );
    }

    assertOnlySeedTags(pinnedTagIds);

    const desired = new Set(pinnedTagIds);

    const tags = await db.transaction(async (tx) => {
      const existing = await tx
        .select({ tagUnitId: UnitTag.tagUnitId })
        .from(UnitTag)
        .where(and(eq(UnitTag.unitId, shelfUnitId), eq(UnitTag.pinned, true)));
      const existingSet = new Set(existing.map((r) => r.tagUnitId));

      const toAdd = [...desired].filter((id) => !existingSet.has(id));
      const toRemove = [...existingSet].filter((id) => !desired.has(id));

      if (toRemove.length > 0) {
        await tx
          .delete(UnitTag)
          .where(
            and(
              eq(UnitTag.unitId, shelfUnitId),
              inArray(UnitTag.tagUnitId, toRemove),
              eq(UnitTag.pinned, true),
            ),
          );
      }
      if (toAdd.length > 0) {
        await tx
          .insert(UnitTag)
          .values(
            toAdd.map((tagUnitId) => ({
              unitId: shelfUnitId,
              tagUnitId,
              score: 0,
              voteCount: 0,
              pinned: true,
              updatedAt: new Date(),
            })),
          )
          .onConflictDoNothing();
      }

      const rows = await tx
        .select({ tagUnitId: UnitTag.tagUnitId, score: UnitTag.score })
        .from(UnitTag)
        .where(and(eq(UnitTag.unitId, shelfUnitId), eq(UnitTag.pinned, true)))
        .orderBy(desc(UnitTag.score));
      return rows.map((r) => ({ tagUnitId: r.tagUnitId, score: r.score }));
    });

    return { tags };
  }

  // --- Shelf unit operations ---

  /**
   * Derive the ShelfUnit kind for a unit at write time.
   */
  async deriveKind(unitId: string): Promise<ShelfUnitKind> {
    const db = await getServerDb();
    const [unit] = await db
      .select({ type: Unit.type, postKind: Post.kind })
      .from(Unit)
      .leftJoin(Post, eq(Unit.id, Post.unitId))
      .where(eq(Unit.id, unitId))
      .limit(1);
    if (!unit) throw new Error(`Unit not found: ${unitId}`);
    return mapUnitToKind(unit.type, unit.postKind ?? null);
  }

  async addUnit(
    shelfId: string,
    req: AddShelfUnitInput,
    userId?: string,
  ): Promise<ShelfUnitDTO> {
    if (shelfId === req.unitId) {
      throw new AppError(400, "A shelf cannot contain itself");
    }

    const kind = req.kind ?? (await this.deriveKind(req.unitId));

    const db = await getServerDb();
    const row = await db.transaction(async (tx) => {
      await ensureShelfUnit(tx, shelfId, req.unitId, kind, req.variantUnitId);
      if (userId) {
        await applyCollectionMetadataDrizzle(tx, userId, req.unitId, {
          tagUnitIds: req.tagUnitIds,
          searchText: req.searchText,
        });
      }
      const found = await findShelfUnit(tx, shelfId, req.unitId);
      if (!found) throw new Error("ShelfUnit not found");
      return found;
    });

    if (userId && req.searchText !== undefined) {
      await enqueueUserUnitCollectionSearchSync(userId, req.unitId);
    }

    await enqueueContainedUnitIdsSync(shelfId);
    return mapShelfUnitToDTO(row);
  }

  async removeUnit(shelfId: string, unitId: string): Promise<void> {
    const db = await getServerDb();
    await db.transaction(async (tx) => {
      await deleteShelfUnit(tx, shelfId, unitId);
    });
    await enqueueContainedUnitIdsSync(shelfId);
  }

  async reorderUnit(
    shelfId: string,
    unitId: string,
    input: ReorderShelfUnitInput,
  ): Promise<ShelfUnitDTO> {
    const db = await getServerDb();
    const [before, after] = await Promise.all([
      input.beforeUnitId
        ? db
            .select({ position: ShelfUnit.position })
            .from(ShelfUnit)
            .where(
              and(
                eq(ShelfUnit.shelfId, shelfId),
                eq(ShelfUnit.unitId, input.beforeUnitId),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      input.afterUnitId
        ? db
            .select({ position: ShelfUnit.position })
            .from(ShelfUnit)
            .where(
              and(
                eq(ShelfUnit.shelfId, shelfId),
                eq(ShelfUnit.unitId, input.afterUnitId),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
    ]);

    const candidate = generateBetween(before?.position, after?.position);

    if (candidate.length > POSITION_LENGTH_THRESHOLD) {
      return await this.rebalanceWindow(
        shelfId,
        unitId,
        input.beforeUnitId,
        input.afterUnitId,
      );
    }

    const [row] = await db
      .update(ShelfUnit)
      .set({ position: candidate, updatedAt: new Date() })
      .where(and(eq(ShelfUnit.shelfId, shelfId), eq(ShelfUnit.unitId, unitId)))
      .returning();
    if (!row) throw new Error("ShelfUnit not found");
    return mapShelfUnitToDTO(row);
  }

  private async rebalanceWindow(
    shelfId: string,
    movedUnitId: string,
    beforeUnitId: string | undefined,
    afterUnitId: string | undefined,
  ): Promise<ShelfUnitDTO> {
    const db = await getServerDb();
    const rows = await db
      .select({ unitId: ShelfUnit.unitId })
      .from(ShelfUnit)
      .where(eq(ShelfUnit.shelfId, shelfId))
      .orderBy(asc(ShelfUnit.position))
      .limit(REBALANCE_WINDOW);

    const ids = rows.map((r) => r.unitId).filter((r) => r !== movedUnitId);
    let insertAt = ids.length;
    if (beforeUnitId) {
      const idx = ids.indexOf(beforeUnitId);
      if (idx >= 0) insertAt = idx + 1;
    } else if (afterUnitId) {
      const idx = ids.indexOf(afterUnitId);
      if (idx >= 0) insertAt = idx;
      else insertAt = 0;
    } else {
      insertAt = ids.length;
    }
    ids.splice(insertAt, 0, movedUnitId);

    const newPositions = rebalance(ids.length);

    await db.transaction(async (tx) => {
      for (const [idx, id] of ids.entries()) {
        await tx
          .update(ShelfUnit)
          .set({ position: newPositions[idx]!, updatedAt: new Date() })
          .where(and(eq(ShelfUnit.shelfId, shelfId), eq(ShelfUnit.unitId, id)));
      }
    });

    const moved = await findShelfUnit(db, shelfId, movedUnitId);
    if (!moved) throw new Error("ShelfUnit not found");
    return mapShelfUnitToDTO(moved);
  }

  async getShelfUnits(
    shelfId: string,
    query: ShelfUnitsQuery = {},
    options: { viewerUserId?: string | null } = {},
  ): Promise<ShelfUnitsResponse> {
    const limit = Math.max(1, Math.min(Number(query.limit ?? 100), 100));
    const searchIds = await this.resolveShelfUnitSearchIds(
      shelfId,
      query,
      options.viewerUserId,
    );

    const db = await getServerDb();
    const units = await db
      .select()
      .from(ShelfUnit)
      .where(
        and(
          eq(ShelfUnit.shelfId, shelfId),
          query.variantUnitId?.trim()
            ? eq(ShelfUnit.variantUnitId, query.variantUnitId.trim())
            : undefined,
          searchIds ? inArray(ShelfUnit.unitId, [...searchIds]) : undefined,
          query.cursor
            ? sql`${ShelfUnit.position} > (
                select su."position"
                from "ShelfUnit" su
                where su."shelfId" = ${shelfId}
                  and su."unitId" = ${query.cursor}
                limit 1
              )`
            : undefined,
        ),
      )
      .orderBy(asc(ShelfUnit.position))
      .limit(limit + 1);

    const hasMore = units.length > limit;
    const page = hasMore ? units.slice(0, limit) : units;
    const unitIds = page.map((p) => p.unitId);

    const relations =
      unitIds.length > 0
        ? await db
            .select()
            .from(ShelfUnitRelation)
            .where(
              and(
                eq(ShelfUnitRelation.shelfId, shelfId),
                or(
                  inArray(ShelfUnitRelation.parentUnitId, unitIds),
                  inArray(ShelfUnitRelation.childUnitId, unitIds),
                ),
              ),
            )
        : [];

    const variantContexts = await hydrateVariantContextSummaries(page);

    return {
      units: page.map((unit) =>
        mapShelfUnitToDTOWithVariantContext(unit, variantContexts),
      ),
      relations: relations.map(mapShelfUnitRelationToDTO),
      hasMore,
    };
  }

  // --- ShelfUnitRelation operations ---

  async attachReview(
    shelfId: string,
    parentUnitId: string,
    reviewUnitId: string,
    reviewKind: ShelfUnitKind = "review",
  ): Promise<ShelfUnitRelationDTO> {
    if (parentUnitId === reviewUnitId) {
      throw new AppError(400, "self_relation_forbidden");
    }

    let didCreateChild = false;
    const db = await getServerDb();
    const relation = await db.transaction(async (tx) => {
      const parent = await findShelfUnit(tx, shelfId, parentUnitId);
      if (!parent) {
        const parentKind = await this.deriveKind(parentUnitId);
        await ensureShelfUnit(tx, shelfId, parentUnitId, parentKind);
      }

      const child = await findShelfUnit(tx, shelfId, reviewUnitId);
      if (!child) {
        const r = await ensureShelfUnit(tx, shelfId, reviewUnitId, reviewKind);
        didCreateChild = r.created;
      }

      return upsertShelfUnitRelation(tx, {
        shelfId,
        parentUnitId,
        childUnitId: reviewUnitId,
        role: "review",
      });
    });

    if (didCreateChild) await enqueueContainedUnitIdsSync(shelfId);
    return mapShelfUnitRelationToDTO(relation);
  }

  async detachReview(
    shelfId: string,
    parentUnitId: string,
    reviewUnitId: string,
  ): Promise<void> {
    const db = await getServerDb();
    await deleteShelfUnitRelations(db, {
      shelfId,
      parentUnitId,
      childUnitId: reviewUnitId,
      role: "review",
    });
  }

  /**
   * Reconcile the children of a parent for a single role to exactly the supplied list.
   * Auto-creates child ShelfUnit rows if needed; end-of-shelf position rule.
   */
  async setChildren(
    shelfId: string,
    parentUnitId: string,
    role: ShelfUnitRelationRole,
    childUnitIds: string[],
    childKind?: ShelfUnitKind,
  ): Promise<void> {
    if (childUnitIds.some((id) => id === parentUnitId)) {
      throw new AppError(400, "self_relation_forbidden");
    }

    let didCreate = false;
    const db = await getServerDb();
    await db.transaction(async (tx) => {
      const parent = await findShelfUnit(tx, shelfId, parentUnitId);
      if (!parent) {
        const parentKind = await this.deriveKind(parentUnitId);
        await ensureShelfUnit(tx, shelfId, parentUnitId, parentKind);
      }

      for (const childId of childUnitIds) {
        const existing = await findShelfUnit(tx, shelfId, childId);
        if (!existing) {
          const kind = childKind ?? (await this.deriveKind(childId));
          const r = await ensureShelfUnit(tx, shelfId, childId, kind);
          didCreate = didCreate || r.created;
        }
      }

      const existingRelations = await tx
        .select({ childUnitId: ShelfUnitRelation.childUnitId })
        .from(ShelfUnitRelation)
        .where(
          and(
            eq(ShelfUnitRelation.shelfId, shelfId),
            eq(ShelfUnitRelation.parentUnitId, parentUnitId),
            eq(ShelfUnitRelation.role, role),
          ),
        );
      const existingSet = new Set(existingRelations.map((r) => r.childUnitId));
      const nextSet = new Set(childUnitIds);

      const toAdd = [...nextSet].filter((id) => !existingSet.has(id));
      const toRemove = [...existingSet].filter((id) => !nextSet.has(id));

      if (toRemove.length > 0) {
        await deleteShelfUnitRelations(tx, {
          shelfId,
          parentUnitId,
          role,
          childUnitIds: toRemove,
        });
      }
      for (const childId of toAdd) {
        await upsertShelfUnitRelation(tx, {
          shelfId,
          parentUnitId,
          childUnitId: childId,
          role,
        });
      }
    });

    if (didCreate) await enqueueContainedUnitIdsSync(shelfId);
  }

  async applyBatch(
    shelfId: string,
    ops: ShelfUnitBatchOp[],
  ): Promise<ShelfUnitBatchResult[]> {
    if (ops.length > SHELF_ITEM_BATCH_OP_CAP) {
      throw new AppError(
        413,
        `Batch exceeds maximum of ${SHELF_ITEM_BATCH_OP_CAP} ops per request`,
      );
    }

    const results: ShelfUnitBatchResult[] = [];
    const touchedUnitIds = new Set<string>();
    let mutated = false;

    const db = await getServerDb();
    await db.transaction(async (tx) => {
      for (const op of ops) {
        try {
          switch (op.op) {
            case "add": {
              if (shelfId === op.unitId) {
                results.push({
                  status: "failed",
                  op,
                  reason: "A shelf cannot contain itself",
                });
                continue;
              }
              const created = await ensureShelfUnit(
                tx,
                shelfId,
                op.unitId,
                op.kind,
                op.variantUnitId,
                op.position,
              );
              if (created.created) {
                mutated = true;
              }
              const row = await findShelfUnit(tx, shelfId, op.unitId);
              if (!row) throw new Error("ShelfUnit not found");
              touchedUnitIds.add(op.unitId);
              results.push({
                status: "ok",
                op,
                unit: mapShelfUnitToDTO(row),
              });
              break;
            }
            case "reorder": {
              const [row] = await tx
                .update(ShelfUnit)
                .set({ position: op.position, updatedAt: new Date() })
                .where(
                  and(
                    eq(ShelfUnit.shelfId, shelfId),
                    eq(ShelfUnit.unitId, op.unitId),
                  ),
                )
                .returning();
              if (!row) throw new Error("ShelfUnit not found");
              touchedUnitIds.add(op.unitId);
              results.push({
                status: "ok",
                op,
                unit: mapShelfUnitToDTO(row),
              });
              break;
            }
            case "reorderToPage": {
              const pageSize = Math.max(
                1,
                Math.min(Number(op.pageSize ?? 20), 100),
              );
              const order = op.order === "desc" ? "desc" : "asc";
              const skip = (op.toPage - 1) * pageSize;
              if (skip < 0) {
                results.push({
                  status: "failed",
                  op,
                  reason: `Invalid page ${op.toPage}`,
                });
                continue;
              }
              const rows = await tx
                .select({ position: ShelfUnit.position })
                .from(ShelfUnit)
                .where(
                  and(
                    eq(ShelfUnit.shelfId, shelfId),
                    ne(ShelfUnit.unitId, op.unitId),
                  ),
                )
                .orderBy(
                  order === "desc"
                    ? desc(ShelfUnit.position)
                    : asc(ShelfUnit.position),
                )
                .offset(Math.max(0, skip - 1))
                .limit(skip === 0 ? 1 : 2);
              const previousVisual = skip === 0 ? undefined : rows[0];
              const first = skip === 0 ? rows[0] : rows[1];
              if (!first) {
                results.push({
                  status: "failed",
                  op,
                  reason: `Page ${op.toPage} is out of range`,
                });
                continue;
              }
              const newPosition =
                order === "desc"
                  ? generateBetween(first.position, previousVisual?.position)
                  : generateBetween(previousVisual?.position, first.position);
              const [row] = await tx
                .update(ShelfUnit)
                .set({ position: newPosition, updatedAt: new Date() })
                .where(
                  and(
                    eq(ShelfUnit.shelfId, shelfId),
                    eq(ShelfUnit.unitId, op.unitId),
                  ),
                )
                .returning();
              if (!row) throw new Error("ShelfUnit not found");
              touchedUnitIds.add(op.unitId);
              results.push({
                status: "ok",
                op,
                unit: mapShelfUnitToDTO(row),
              });
              break;
            }
            case "delete": {
              const deleted = await deleteShelfUnit(tx, shelfId, op.unitId);
              if (deleted > 0) {
                mutated = true;
              }
              results.push({ status: "ok", op });
              break;
            }
            case "attach": {
              if (op.parentUnitId === op.childUnitId) {
                results.push({
                  status: "failed",
                  op,
                  reason: "self_relation_forbidden",
                });
                continue;
              }
              const existingChild = await findShelfUnit(
                tx,
                shelfId,
                op.childUnitId,
              );
              if (!existingChild) {
                const r = await ensureShelfUnit(
                  tx,
                  shelfId,
                  op.childUnitId,
                  op.childKind,
                  op.childVariantUnitId,
                  op.position,
                );
                if (r.created) mutated = true;
              }
              const relation = await upsertShelfUnitRelation(tx, {
                shelfId,
                parentUnitId: op.parentUnitId,
                childUnitId: op.childUnitId,
                role: op.role,
              });
              touchedUnitIds.add(op.childUnitId);
              const childRow = await findShelfUnit(tx, shelfId, op.childUnitId);
              results.push({
                status: "ok",
                op,
                unit: childRow ? mapShelfUnitToDTO(childRow) : undefined,
                relation: mapShelfUnitRelationToDTO(relation),
              });
              break;
            }
            case "detach": {
              await deleteShelfUnitRelations(tx, {
                shelfId,
                parentUnitId: op.parentUnitId,
                childUnitId: op.childUnitId,
                role: op.role,
              });
              results.push({ status: "ok", op });
              break;
            }
            case "setChildren": {
              if (op.childUnitIds.some((id) => id === op.parentUnitId)) {
                results.push({
                  status: "failed",
                  op,
                  reason: "self_relation_forbidden",
                });
                continue;
              }
              for (const childId of op.childUnitIds) {
                const existing = await findShelfUnit(tx, shelfId, childId);
                if (!existing) {
                  const kind = op.childKind ?? (await this.deriveKind(childId));
                  const r = await ensureShelfUnit(tx, shelfId, childId, kind);
                  if (r.created) mutated = true;
                }
              }
              const existingRelations = await tx
                .select({ childUnitId: ShelfUnitRelation.childUnitId })
                .from(ShelfUnitRelation)
                .where(
                  and(
                    eq(ShelfUnitRelation.shelfId, shelfId),
                    eq(ShelfUnitRelation.parentUnitId, op.parentUnitId),
                    eq(ShelfUnitRelation.role, op.role),
                  ),
                );
              const existingSet = new Set(
                existingRelations.map((r) => r.childUnitId),
              );
              const nextSet = new Set(op.childUnitIds);
              const toAdd = [...nextSet].filter((id) => !existingSet.has(id));
              const toRemove = [...existingSet].filter(
                (id) => !nextSet.has(id),
              );
              if (toRemove.length > 0) {
                await deleteShelfUnitRelations(tx, {
                  shelfId,
                  parentUnitId: op.parentUnitId,
                  role: op.role,
                  childUnitIds: toRemove,
                });
              }
              for (const childId of toAdd) {
                await upsertShelfUnitRelation(tx, {
                  shelfId,
                  parentUnitId: op.parentUnitId,
                  childUnitId: childId,
                  role: op.role,
                });
              }
              results.push({ status: "ok", op });
              break;
            }
            default: {
              const unknown = op as { op: string };
              results.push({
                status: "failed",
                op,
                reason: `Unknown op: ${unknown.op}`,
              });
            }
          }
        } catch (err) {
          results.push({
            status: "failed",
            op,
            reason: err instanceof Error ? err.message : String(err),
          });
        }
      }
    });

    if (touchedUnitIds.size > 0) {
      for (let i = 0; i < results.length; i += 1) {
        const r = results[i]!;
        if (
          r.status === "ok" &&
          (r.op.op === "add" ||
            r.op.op === "reorder" ||
            r.op.op === "reorderToPage")
        ) {
          const opUnitId = r.op.unitId;
          if (touchedUnitIds.has(opUnitId)) {
            const fresh = await findShelfUnit(db, shelfId, opUnitId);
            if (fresh) {
              results[i] = {
                status: "ok",
                op: r.op,
                unit: mapShelfUnitToDTO(fresh),
              };
            }
          }
        }
      }
    }

    if (mutated) {
      await enqueueContainedUnitIdsSync(shelfId);
    }

    return results;
  }

  async cleanupOrphans(
    shelfId: string,
    orphanUnitIds: string[],
  ): Promise<{ deleted: number }> {
    if (orphanUnitIds.length === 0) return { deleted: 0 };
    const db = await getServerDb();
    const deleted = await db.transaction(async (tx) => {
      const rows = await tx
        .delete(ShelfUnit)
        .where(
          and(
            eq(ShelfUnit.shelfId, shelfId),
            inArray(ShelfUnit.unitId, orphanUnitIds),
          ),
        )
        .returning({ unitId: ShelfUnit.unitId });
      if (rows.length > 0) {
        await tx
          .update(Shelf)
          .set({
            itemCount: sql`${Shelf.itemCount} - ${rows.length}`,
            updatedAt: new Date(),
          })
          .where(eq(Shelf.unitId, shelfId));
      }
      return rows.length;
    });
    if (deleted > 0) {
      await enqueueContainedUnitIdsSync(shelfId);
    }
    return { deleted };
  }
}

export function mapUnitToKind(
  type: typeof Unit.$inferSelect.type,
  postKind: typeof Post.$inferSelect.kind | null,
): ShelfUnitKind {
  if (type === "POST") {
    if (postKind === "CHAPTER") return "chapter";
    if (postKind === "REVIEW") return "review";
    if (postKind === "EXCERPT") return "quote";
    return "post";
  }
  switch (type) {
    case "BOOK":
      return "book";
    case "TAG":
      return "tag";
    case "REALM":
      return "realm";
    case "SHELF":
      return "shelf";
    case "LINK":
      return "link";
    case "GAME":
      return "game";
    case "MEDIA":
      return "media";
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    default:
      return type.toString().toLowerCase() as ShelfUnitKind;
  }
}

export const shelfService = new ShelfService();
