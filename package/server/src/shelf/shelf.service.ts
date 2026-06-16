import type {
  AddShelfItemInput,
  CreateShelfInput,
  ReorderShelfItemInput,
  SeedTagName,
  SetPinnedTagsResponse,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemBatchOp,
  ShelfItemBatchResult,
  ShelfItemChildDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemParentRole,
  ShelfItemsQuery,
  ShelfItemsResponse,
  ShelfItemType,
  ShelfListQuery,
  ShelfMatchedUnitDTO,
  ShelfSummaryDTO,
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
  type SQL,
  sql,
} from "drizzle-orm";
import { nullableContentDocJson } from "@/content-doc/json-write";
import { getSeedTagId } from "@/infra/seed-tags";
import { serverJobProducer } from "@/job/job-boundary";
import { searchClient } from "@/meili/search-client";
import { assertLicenseSlug } from "@/unit/publication-policy";
import { AppError } from "@/utils/errors";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import {
  Post,
  Shelf,
  ShelfItem,
  Unit,
  UnitTag,
  UnitTranslation,
  User,
  UserTagApplication,
} from "../db/schema";
import {
  generateBetween,
  POSITION_LENGTH_THRESHOLD,
  rebalance,
} from "./fractional-index";
import { enqueueShelfItemSourceSearchSync } from "./user-shelf-item.service";

export const SHELF_ITEM_BATCH_OP_CAP = 200;

import {
  mapShelfDetailToDTO,
  mapShelfItemToDTO,
  mapShelfListRowToDTO,
  mapShelfSummaryToDTO,
  mapShelfToDTO,
} from "./shelf.mapper";
import { isReservedShelfSlug } from "./system-shelves";

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
    .select({ position: ShelfItem.position })
    .from(ShelfItem)
    .where(eq(ShelfItem.shelfId, shelfId))
    .orderBy(desc(ShelfItem.position))
    .limit(1);
  return generateBetween(last?.position, undefined);
}

async function ensureShelfItem(
  tx: DbLike,
  shelfId: string,
  itemId: string,
  kind: ShelfItemKind,
  itemType: ShelfItemType = "unit",
  explicitPosition?: string,
  parentItemId?: string | null,
  parentItemType?: ShelfItemType | null,
  parentRole?: ShelfItemParentRole | null,
  searchText?: string | null,
): Promise<{ created: boolean }> {
  const position = explicitPosition ?? (await nextShelfPosition(tx, shelfId));
  const created = await tx
    .insert(ShelfItem)
    .values({
      shelfId,
      itemType,
      itemId,
      kind,
      parentItemType: parentItemId ? (parentItemType ?? "unit") : null,
      parentItemId: parentItemId ?? null,
      parentRole: parentRole ?? null,
      position,
      searchText: searchText ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ itemId: ShelfItem.itemId });
  if (created.length === 0 && searchText !== undefined) {
    await tx
      .update(ShelfItem)
      .set({
        searchText,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(ShelfItem.shelfId, shelfId),
          eq(ShelfItem.itemType, itemType),
          eq(ShelfItem.itemId, itemId),
        ),
      );
  }
  if (created.length > 0) {
    await tx
      .update(Shelf)
      .set({
        itemCount: sql`${Shelf.itemCount} + ${created.length}`,
        ...(parentItemId
          ? {}
          : { rootItemCount: sql`${Shelf.rootItemCount} + ${created.length}` }),
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, shelfId));
  }
  return { created: created.length > 0 };
}

async function deleteShelfItem(
  tx: DbLike,
  shelfId: string,
  itemId: string,
  itemType: ShelfItemType = "unit",
): Promise<number> {
  const deleted = await tx
    .delete(ShelfItem)
    .where(
      and(
        eq(ShelfItem.shelfId, shelfId),
        eq(ShelfItem.itemType, itemType),
        eq(ShelfItem.itemId, itemId),
      ),
    )
    .returning({
      itemId: ShelfItem.itemId,
      parentItemId: ShelfItem.parentItemId,
    });
  if (deleted.length > 0) {
    const deletedRootCount = deleted.filter(
      (row: { parentItemId: string | null }) => !row.parentItemId,
    ).length;
    await tx
      .update(Shelf)
      .set({
        itemCount: sql`${Shelf.itemCount} - ${deleted.length}`,
        ...(deletedRootCount > 0
          ? { rootItemCount: sql`${Shelf.rootItemCount} - ${deletedRootCount}` }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, shelfId));
  }
  return deleted.length;
}

async function applyShelfItemMetadataDrizzle(
  tx: DbLike,
  userId: string,
  unitId: string,
  patch: Pick<AddShelfItemInput, "tagUnitIds" | "searchText">,
): Promise<void> {
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

async function findShelfItem(
  tx: DbLike,
  shelfId: string,
  itemId: string,
  itemType: ShelfItemType = "unit",
) {
  const [row] = await tx
    .select()
    .from(ShelfItem)
    .where(
      and(
        eq(ShelfItem.shelfId, shelfId),
        eq(ShelfItem.itemType, itemType),
        eq(ShelfItem.itemId, itemId),
      ),
    )
    .limit(1);
  return row ?? null;
}

async function upsertShelfItemChild(
  tx: DbLike,
  input: {
    shelfId: string;
    parentItemType?: ShelfItemType;
    parentItemId: string;
    childItemType?: ShelfItemType;
    childItemId: string;
    role: ShelfItemParentRole;
  },
) {
  const [before] = await tx
    .select({ parentItemId: ShelfItem.parentItemId })
    .from(ShelfItem)
    .where(
      and(
        eq(ShelfItem.shelfId, input.shelfId),
        eq(ShelfItem.itemType, input.childItemType ?? "unit"),
        eq(ShelfItem.itemId, input.childItemId),
      ),
    )
    .limit(1);
  const [row] = await tx
    .update(ShelfItem)
    .set({
      parentItemType: input.parentItemType ?? "unit",
      parentItemId: input.parentItemId,
      parentRole: input.role,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ShelfItem.shelfId, input.shelfId),
        eq(ShelfItem.itemType, input.childItemType ?? "unit"),
        eq(ShelfItem.itemId, input.childItemId),
      ),
    )
    .returning();
  if (!row) throw new Error("ShelfItem child not found");
  if (!before?.parentItemId && row.parentItemId) {
    await tx
      .update(Shelf)
      .set({
        rootItemCount: sql`${Shelf.rootItemCount} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, input.shelfId));
  }
  return {
    shelfId: row.shelfId,
    parentItemType: (row.parentItemType ?? "unit") as ShelfItemType,
    parentItemId: input.parentItemId,
    childItemType: row.itemType as ShelfItemType,
    childItemId: row.itemId,
    role: row.parentRole as ShelfItemParentRole,
  };
}

async function deleteShelfItemChildren(
  tx: DbLike,
  input: {
    shelfId: string;
    parentItemType?: ShelfItemType;
    parentItemId?: string;
    childItemType?: ShelfItemType;
    childItemId?: string;
    childItemIds?: string[];
    role?: ShelfItemParentRole;
  },
) {
  const updated = await tx
    .update(ShelfItem)
    .set({
      parentItemType: null,
      parentItemId: null,
      parentRole: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ShelfItem.shelfId, input.shelfId),
        input.parentItemId
          ? eq(ShelfItem.parentItemId, input.parentItemId)
          : undefined,
        input.parentItemId
          ? eq(ShelfItem.parentItemType, input.parentItemType ?? "unit")
          : undefined,
        input.childItemType
          ? eq(ShelfItem.itemType, input.childItemType)
          : undefined,
        input.childItemId ? eq(ShelfItem.itemId, input.childItemId) : undefined,
        input.childItemIds?.length
          ? inArray(ShelfItem.itemId, input.childItemIds)
          : undefined,
        input.role ? eq(ShelfItem.parentRole, input.role) : undefined,
      ),
    )
    .returning({ itemId: ShelfItem.itemId });
  if (updated.length > 0) {
    await tx
      .update(Shelf)
      .set({
        rootItemCount: sql`${Shelf.rootItemCount} + ${updated.length}`,
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, input.shelfId));
  }
  return updated;
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
  summary: User.summary,
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
  private async resolveShelfItemSearchIds(
    shelfId: string,
    query: ShelfItemsQuery,
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
      const [contentResp, shelfItemResp] = await Promise.all([
        searchClient.contentIndex.search(q, {
          limit: SHELF_SEARCH_HIT_LIMIT,
          attributesToRetrieve: ["id"],
        }),
        viewerUserId === ownerUserId
          ? searchClient.shelfItemIndex.search(q, {
              limit: SHELF_SEARCH_HIT_LIMIT,
              filter: `shelfId = "${shelfId}" AND shelfOwnerUserId = "${ownerUserId}" AND itemType = "unit"`,
              attributesToRetrieve: ["itemId"],
            })
          : Promise.resolve({ hits: [] as any[] }),
      ]);

      allowedIds = new Set([
        ...(contentResp.hits as any[])
          .map((hit) => hit.id)
          .filter((id): id is string => typeof id === "string"),
        ...(shelfItemResp.hits as any[])
          .map((hit) => hit.itemId)
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

  private buildWhere(
    options: ShelfListQuery,
    scope: { ownerUserId?: string; publicOnly?: boolean } = {
      publicOnly: true,
    },
  ): SQL | undefined {
    const conditions: SQL[] = [eq(Unit.type, "SHELF")];

    if (scope.publicOnly ?? true) {
      conditions.push(
        eq(Unit.status, "PUBLISHED"),
        eq(Unit.visibility, "PUBLIC"),
        eq(Unit.moderationStatus, "APPROVED"),
      );
    }

    if (scope.ownerUserId) {
      conditions.push(eq(Unit.userId, scope.ownerUserId));
    }

    if (options.userId?.trim()) {
      conditions.push(eq(Unit.userId, options.userId));
    }

    const q = options.q?.trim();
    if (q) {
      conditions.push(sql`exists (
        select 1 from "UnitTranslation" st
        where st."unitId" = ${Shelf.unitId}
          and st."title" ilike ${`%${q}%`}
      )`);
    }

    const tagIds = Array.from(
      new Set((options.tagIds ?? []).map((id) => id.trim()).filter(Boolean)),
    );
    for (const tagId of tagIds) {
      conditions.push(sql`exists (
        select 1 from "UnitTag" sut
        where sut."unitId" = ${Shelf.unitId}
          and sut."tagUnitId" = ${tagId}
      )`);
    }

    const containsUnitId = options.containsUnitId?.trim();
    if (containsUnitId) {
      conditions.push(sql`exists (
        select 1 from "ShelfItem" su
        where su."shelfId" = ${Shelf.unitId}
          and su."itemId" = ${containsUnitId}
      )`);
    }

    const variantUnitId = options.variantUnitId?.trim();
    if (variantUnitId) {
      conditions.push(sql`exists (
        select 1 from "ShelfItem" su
        where su."shelfId" = ${Shelf.unitId}
          and su."itemId" = ${variantUnitId}
          and su."parentRole" = 'variant'
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
    if (field === "itemCount") {
      return [direction(Shelf.itemCount), desc(Shelf.unitId)];
    }
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
    const where = this.buildWhere(options, { publicOnly: true });
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

  async listMine(
    userId: string,
    options: ShelfListQuery = {},
  ): Promise<{ shelves: ShelfDTO[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const hasCursor = Boolean(options.cursor?.unitId);
    const skipNum = hasCursor ? 1 : (options.start ?? 0);
    const where = this.buildWhere(options, {
      ownerUserId: userId,
      publicOnly: false,
    });
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
    return {
      shelves: hydratedRows.map((row) => mapShelfListRowToDTO(row)),
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
    const shelfItems = await db
      .select({
        shelfId: ShelfItem.shelfId,
        unitId: ShelfItem.itemId,
        kind: ShelfItem.kind,
      })
      .from(ShelfItem)
      .where(
        and(
          inArray(ShelfItem.shelfId, shelfIds),
          containsUnitId ? eq(ShelfItem.itemId, containsUnitId) : undefined,
          variantUnitId
            ? and(
                eq(ShelfItem.itemId, variantUnitId),
                eq(ShelfItem.parentRole, "variant"),
              )
            : undefined,
        ),
      )
      .orderBy(asc(ShelfItem.position));

    const matchedUnitIds = [...new Set(shelfItems.map((row) => row.unitId))];
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

    for (const row of shelfItems) {
      if (out.has(row.shelfId)) continue;
      const matchedUnitId = row.unitId;
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
   * Resolve `{ ownerUserId, slug }` under the owner scope. Only reserved shelf
   * slugs are accepted in v1 — every other slug returns null per
   * `SHELF_CUSTOM_SLUG_DISABLED`.
   * 在所有者作用域下解析 `{ ownerUserId, slug }`。v1 仅接受保留书架
   * slug；其他 slug 一律按 `SHELF_CUSTOM_SLUG_DISABLED` 返回 null。
   *
   * Lookup goes through the Unit slug index `(slugScope = ownerUserId,
   * slug)` so the resolver shares the path used by every other slug-bearing
   * Unit.
   * 查找走 Unit 的 slug 索引 `(slugScope = ownerUserId, slug)`，使该解析器与所有其他带 slug 的 Unit 共用同一路径。
   */
  async getByOwnerAndSlug(
    ownerUserId: string,
    slug: string,
  ): Promise<ShelfDetailDTO | null> {
    if (!isReservedShelfSlug(slug)) return null;
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
    const { title, coverUrl, visibility, tagIds, extra, translations } = req;

    // v1 rejects any client-supplied slug for user-created shelves
    // (schema-enforced) — system shelves only. Custom slugs are a deliberate
    // future toggle, not an oversight. Guard against any payload that smuggles
    // a `slug` field (SHELF_CUSTOM_SLUG_DISABLED).
    // v1 拒绝用户创建书架时客户端提供的任何 slug（由 schema 强制）— 仅限系统书架。
    // 自定义 slug 是有意保留的未来开关，并非疏漏。防范任何夹带 `slug` 字段的载荷
    // （SHELF_CUSTOM_SLUG_DISABLED）。
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
    const { coverUrl, visibility, extra, title } = req;
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
    shelfItemId: string,
    pinnedTagIds: readonly string[],
    actorUserId: string,
  ): Promise<SetPinnedTagsResponse> {
    const db = await getServerDb();
    const [shelf] = await db
      .select({ userId: Unit.userId })
      .from(Shelf)
      .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
      .where(eq(Shelf.unitId, shelfItemId))
      .limit(1);
    if (!shelf) {
      throw new AppError(404, `Shelf not found: ${shelfItemId}`);
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
        .where(and(eq(UnitTag.unitId, shelfItemId), eq(UnitTag.pinned, true)));
      const existingSet = new Set(existing.map((r) => r.tagUnitId));

      const toAdd = [...desired].filter((id) => !existingSet.has(id));
      const toRemove = [...existingSet].filter((id) => !desired.has(id));

      if (toRemove.length > 0) {
        await tx
          .delete(UnitTag)
          .where(
            and(
              eq(UnitTag.unitId, shelfItemId),
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
              unitId: shelfItemId,
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
        .where(and(eq(UnitTag.unitId, shelfItemId), eq(UnitTag.pinned, true)))
        .orderBy(desc(UnitTag.score));
      return rows.map((r) => ({ tagUnitId: r.tagUnitId, score: r.score }));
    });

    return { tags };
  }

  // --- Shelf item operations ---
  // --- 书架条目操作 ---

  /**
   * Derive the ShelfItem kind for a unit at write time.
   * 在写入时为某个 unit 推导其 ShelfItem kind。
   */
  async deriveKind(unitId: string): Promise<ShelfItemKind> {
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

  async addItem(
    shelfId: string,
    req: AddShelfItemInput,
    userId?: string,
  ): Promise<ShelfItemDTO> {
    if (req.itemType === "unit" && shelfId === req.itemId) {
      throw new AppError(400, "A shelf cannot contain itself");
    }

    const kind = req.kind ?? (await this.deriveKind(req.itemId));

    const db = await getServerDb();
    const row = await db.transaction(async (tx) => {
      await ensureShelfItem(
        tx,
        shelfId,
        req.itemId,
        kind,
        req.itemType,
        undefined,
        req.parentItemId,
        req.parentItemType,
        req.parentRole,
        req.searchText,
      );
      if (userId && req.itemType === "unit") {
        await applyShelfItemMetadataDrizzle(tx, userId, req.itemId, {
          tagUnitIds: req.tagUnitIds,
          searchText: req.searchText,
        });
      }
      const found = await findShelfItem(tx, shelfId, req.itemId, req.itemType);
      if (!found) throw new Error("ShelfItem not found");
      return found;
    });

    if (userId && req.itemType === "unit" && req.searchText !== undefined) {
      await enqueueShelfItemSourceSearchSync(req.itemType, req.itemId);
    }

    await enqueueContainedUnitIdsSync(shelfId);
    return mapShelfItemToDTO(row);
  }

  async removeItem(
    shelfId: string,
    itemId: string,
    itemType: ShelfItemType = "unit",
  ): Promise<void> {
    const db = await getServerDb();
    await db.transaction(async (tx) => {
      await deleteShelfItem(tx, shelfId, itemId, itemType);
    });
    await enqueueContainedUnitIdsSync(shelfId);
  }

  async reorderItem(
    shelfId: string,
    itemId: string,
    input: ReorderShelfItemInput,
    itemType: ShelfItemType = "unit",
  ): Promise<ShelfItemDTO> {
    const db = await getServerDb();
    const [before, after] = await Promise.all([
      input.beforeItemId
        ? db
            .select({ position: ShelfItem.position })
            .from(ShelfItem)
            .where(
              and(
                eq(ShelfItem.shelfId, shelfId),
                eq(ShelfItem.itemType, itemType),
                eq(ShelfItem.itemId, input.beforeItemId),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),
      input.afterItemId
        ? db
            .select({ position: ShelfItem.position })
            .from(ShelfItem)
            .where(
              and(
                eq(ShelfItem.shelfId, shelfId),
                eq(ShelfItem.itemType, itemType),
                eq(ShelfItem.itemId, input.afterItemId),
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
        itemId,
        input.beforeItemId,
        input.afterItemId,
        itemType,
      );
    }

    const [row] = await db
      .update(ShelfItem)
      .set({ position: candidate, updatedAt: new Date() })
      .where(
        and(
          eq(ShelfItem.shelfId, shelfId),
          eq(ShelfItem.itemType, itemType),
          eq(ShelfItem.itemId, itemId),
        ),
      )
      .returning();
    if (!row) throw new Error("ShelfItem not found");
    return mapShelfItemToDTO(row);
  }

  private async rebalanceWindow(
    shelfId: string,
    movedItemId: string,
    beforeItemId: string | undefined,
    afterItemId: string | undefined,
    itemType: ShelfItemType = "unit",
  ): Promise<ShelfItemDTO> {
    const db = await getServerDb();
    const rows = await db
      .select({ itemId: ShelfItem.itemId })
      .from(ShelfItem)
      .where(
        and(eq(ShelfItem.shelfId, shelfId), eq(ShelfItem.itemType, itemType)),
      )
      .orderBy(asc(ShelfItem.position))
      .limit(REBALANCE_WINDOW);

    const ids = rows.map((r) => r.itemId).filter((r) => r !== movedItemId);
    let insertAt = ids.length;
    if (beforeItemId) {
      const idx = ids.indexOf(beforeItemId);
      if (idx >= 0) insertAt = idx + 1;
    } else if (afterItemId) {
      const idx = ids.indexOf(afterItemId);
      if (idx >= 0) insertAt = idx;
      else insertAt = 0;
    } else {
      insertAt = ids.length;
    }
    ids.splice(insertAt, 0, movedItemId);

    const newPositions = rebalance(ids.length);

    await db.transaction(async (tx) => {
      for (const [idx, id] of ids.entries()) {
        await tx
          .update(ShelfItem)
          .set({ position: newPositions[idx]!, updatedAt: new Date() })
          .where(
            and(
              eq(ShelfItem.shelfId, shelfId),
              eq(ShelfItem.itemType, itemType),
              eq(ShelfItem.itemId, id),
            ),
          );
      }
    });

    const moved = await findShelfItem(db, shelfId, movedItemId, itemType);
    if (!moved) throw new Error("ShelfItem not found");
    return mapShelfItemToDTO(moved);
  }

  async getShelfItems(
    shelfId: string,
    query: ShelfItemsQuery = {},
    options: { viewerUserId?: string | null } = {},
  ): Promise<ShelfItemsResponse> {
    const limit = Math.max(1, Math.min(Number(query.limit ?? 100), 100));
    const searchIds = await this.resolveShelfItemSearchIds(
      shelfId,
      query,
      options.viewerUserId,
    );

    const db = await getServerDb();
    const items = await db
      .select()
      .from(ShelfItem)
      .where(
        and(
          eq(ShelfItem.shelfId, shelfId),
          sql`${ShelfItem.parentItemId} is null`,
          query.itemType ? eq(ShelfItem.itemType, query.itemType) : undefined,
          query.variantUnitId?.trim()
            ? sql`exists (
                  select 1 from "ShelfItem" child
                  where child."shelfId" = ${ShelfItem.shelfId}
                    and child."parentItemType" = ${ShelfItem.itemType}
                    and child."parentItemId" = ${ShelfItem.itemId}
                    and child."itemId" = ${query.variantUnitId.trim()}
                    and child."parentRole" = 'variant'
                )`
            : undefined,
          searchIds ? inArray(ShelfItem.itemId, [...searchIds]) : undefined,
          query.cursor
            ? sql`${ShelfItem.position} > (
                select su."position"
                from "ShelfItem" su
                where su."shelfId" = ${shelfId}
                  and su."itemId" = ${query.cursor}
                limit 1
              )`
            : undefined,
        ),
      )
      .orderBy(asc(ShelfItem.position))
      .limit(limit + 1);

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;
    const pageItemIds = page.map((p) => p.itemId);

    const childRows =
      pageItemIds.length > 0
        ? await db
            .select()
            .from(ShelfItem)
            .where(
              and(
                eq(ShelfItem.shelfId, shelfId),
                inArray(ShelfItem.parentItemId, pageItemIds),
              ),
            )
            .orderBy(asc(ShelfItem.position))
        : [];

    const seenItems = new Set<string>();
    const allItems = [...page, ...childRows].filter((row) => {
      const key = `${row.itemType}:${row.itemId}`;
      if (seenItems.has(key)) return false;
      seenItems.add(key);
      return true;
    });
    const itemDTOs = allItems.map((item) => mapShelfItemToDTO(item));
    const relations = childRows
      .filter((row) => row.parentItemId && row.parentRole)
      .map((row) => ({
        shelfId: row.shelfId,
        parentItemType: (row.parentItemType ?? "unit") as ShelfItemType,
        parentItemId: row.parentItemId!,
        childItemType: row.itemType as ShelfItemType,
        childItemId: row.itemId,
        role: row.parentRole as ShelfItemParentRole,
      }));

    return {
      items: itemDTOs,
      relations,
      hasMore,
    };
  }

  // --- ShelfItemChild operations ---
  // --- ShelfItemChild 操作 ---

  async attachReview(
    shelfId: string,
    parentItemId: string,
    reviewUnitId: string,
    reviewKind: ShelfItemKind = "review",
  ): Promise<ShelfItemChildDTO> {
    if (parentItemId === reviewUnitId) {
      throw new AppError(400, "self_relation_forbidden");
    }

    let didCreateChild = false;
    const db = await getServerDb();
    const relation = await db.transaction(async (tx) => {
      const parent = await findShelfItem(tx, shelfId, parentItemId);
      if (!parent) {
        const parentKind = await this.deriveKind(parentItemId);
        await ensureShelfItem(tx, shelfId, parentItemId, parentKind, "unit");
      }

      const child = await findShelfItem(tx, shelfId, reviewUnitId);
      if (!child) {
        const r = await ensureShelfItem(
          tx,
          shelfId,
          reviewUnitId,
          reviewKind,
          "unit",
          undefined,
          parentItemId,
          "unit",
          "review",
        );
        didCreateChild = r.created;
      }

      return upsertShelfItemChild(tx, {
        shelfId,
        parentItemId,
        childItemId: reviewUnitId,
        role: "review",
      });
    });

    if (didCreateChild) await enqueueContainedUnitIdsSync(shelfId);
    return relation;
  }

  async detachReview(
    shelfId: string,
    parentItemId: string,
    reviewUnitId: string,
  ): Promise<void> {
    const db = await getServerDb();
    await deleteShelfItemChildren(db, {
      shelfId,
      parentItemId,
      childItemId: reviewUnitId,
      role: "review",
    });
  }

  /**
   * Reconcile the children of a parent for a single role to exactly the supplied list.
   * Auto-creates child ShelfItem rows if needed; end-of-shelf position rule.
   * 将某父项在单一 role 下的子项精确对齐到所提供的列表。必要时自动创建子 ShelfItem 行；采用书架末尾的 position 规则。
   */
  async setChildren(
    shelfId: string,
    parentItemId: string,
    role: ShelfItemParentRole,
    childItemIds: string[],
    childKind?: ShelfItemKind,
  ): Promise<void> {
    if (childItemIds.some((id) => id === parentItemId)) {
      throw new AppError(400, "self_relation_forbidden");
    }

    let didCreate = false;
    const db = await getServerDb();
    await db.transaction(async (tx) => {
      const parent = await findShelfItem(tx, shelfId, parentItemId);
      if (!parent) {
        const parentKind = await this.deriveKind(parentItemId);
        await ensureShelfItem(tx, shelfId, parentItemId, parentKind, "unit");
      }

      for (const childId of childItemIds) {
        const existing = await findShelfItem(tx, shelfId, childId);
        if (!existing) {
          const kind = childKind ?? (await this.deriveKind(childId));
          const r = await ensureShelfItem(
            tx,
            shelfId,
            childId,
            kind,
            "unit",
            undefined,
            parentItemId,
            "unit",
            role,
          );
          didCreate = didCreate || r.created;
        }
      }

      const existingRelations = await tx
        .select({ childItemId: ShelfItem.itemId })
        .from(ShelfItem)
        .where(
          and(
            eq(ShelfItem.shelfId, shelfId),
            eq(ShelfItem.parentItemId, parentItemId),
            eq(ShelfItem.parentRole, role),
          ),
        );
      const existingSet = new Set(existingRelations.map((r) => r.childItemId));
      const nextSet = new Set(childItemIds);

      const toAdd = [...nextSet].filter((id) => !existingSet.has(id));
      const toRemove = [...existingSet].filter((id) => !nextSet.has(id));

      if (toRemove.length > 0) {
        await deleteShelfItemChildren(tx, {
          shelfId,
          parentItemId,
          role,
          childItemIds: toRemove,
        });
      }
      for (const childId of toAdd) {
        await upsertShelfItemChild(tx, {
          shelfId,
          parentItemId,
          childItemId: childId,
          role,
        });
      }
    });

    if (didCreate) await enqueueContainedUnitIdsSync(shelfId);
  }

  async applyBatch(
    shelfId: string,
    ops: ShelfItemBatchOp[],
  ): Promise<ShelfItemBatchResult[]> {
    if (ops.length > SHELF_ITEM_BATCH_OP_CAP) {
      throw new AppError(
        413,
        `Batch exceeds maximum of ${SHELF_ITEM_BATCH_OP_CAP} ops per request`,
      );
    }

    const results: ShelfItemBatchResult[] = [];
    const touchedItems = new Map<string, ShelfItemType>();
    let mutated = false;

    const db = await getServerDb();
    await db.transaction(async (tx) => {
      for (const op of ops) {
        try {
          switch (op.op) {
            case "add": {
              if (op.itemType === "unit" && shelfId === op.itemId) {
                results.push({
                  status: "failed",
                  op,
                  reason: "A shelf cannot contain itself",
                });
                continue;
              }
              const created = await ensureShelfItem(
                tx,
                shelfId,
                op.itemId,
                op.kind,
                op.itemType,
                op.position,
                op.parentItemId,
                op.parentItemType,
                op.parentRole,
              );
              if (created.created) {
                mutated = true;
              }
              const row = await findShelfItem(
                tx,
                shelfId,
                op.itemId,
                op.itemType,
              );
              if (!row) throw new Error("ShelfItem not found");
              touchedItems.set(op.itemId, op.itemType);
              results.push({
                status: "ok",
                op,
                item: mapShelfItemToDTO(row),
              });
              break;
            }
            case "reorder": {
              const [row] = await tx
                .update(ShelfItem)
                .set({ position: op.position, updatedAt: new Date() })
                .where(
                  and(
                    eq(ShelfItem.shelfId, shelfId),
                    eq(ShelfItem.itemType, op.itemType),
                    eq(ShelfItem.itemId, op.itemId),
                  ),
                )
                .returning();
              if (!row) throw new Error("ShelfItem not found");
              touchedItems.set(op.itemId, op.itemType);
              results.push({
                status: "ok",
                op,
                item: mapShelfItemToDTO(row),
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
                .select({ position: ShelfItem.position })
                .from(ShelfItem)
                .where(
                  and(
                    eq(ShelfItem.shelfId, shelfId),
                    eq(ShelfItem.itemType, op.itemType),
                    ne(ShelfItem.itemId, op.itemId),
                  ),
                )
                .orderBy(
                  order === "desc"
                    ? desc(ShelfItem.position)
                    : asc(ShelfItem.position),
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
                .update(ShelfItem)
                .set({ position: newPosition, updatedAt: new Date() })
                .where(
                  and(
                    eq(ShelfItem.shelfId, shelfId),
                    eq(ShelfItem.itemType, op.itemType),
                    eq(ShelfItem.itemId, op.itemId),
                  ),
                )
                .returning();
              if (!row) throw new Error("ShelfItem not found");
              touchedItems.set(op.itemId, op.itemType);
              results.push({
                status: "ok",
                op,
                item: mapShelfItemToDTO(row),
              });
              break;
            }
            case "delete": {
              const deleted = await deleteShelfItem(
                tx,
                shelfId,
                op.itemId,
                op.itemType,
              );
              if (deleted > 0) {
                mutated = true;
              }
              results.push({ status: "ok", op });
              break;
            }
            case "attach": {
              if (op.parentItemId === op.childItemId) {
                results.push({
                  status: "failed",
                  op,
                  reason: "self_relation_forbidden",
                });
                continue;
              }
              const existingChild = await findShelfItem(
                tx,
                shelfId,
                op.childItemId,
                op.childItemType,
              );
              if (!existingChild) {
                const r = await ensureShelfItem(
                  tx,
                  shelfId,
                  op.childItemId,
                  op.childKind,
                  op.childItemType,
                  op.position,
                  op.parentItemId,
                  op.parentItemType,
                  op.role,
                );
                if (r.created) mutated = true;
              }
              const relation = await upsertShelfItemChild(tx, {
                shelfId,
                parentItemId: op.parentItemId,
                parentItemType: op.parentItemType,
                childItemId: op.childItemId,
                childItemType: op.childItemType,
                role: op.role,
              });
              touchedItems.set(op.childItemId, op.childItemType);
              const childRow = await findShelfItem(
                tx,
                shelfId,
                op.childItemId,
                op.childItemType,
              );
              results.push({
                status: "ok",
                op,
                item: childRow ? mapShelfItemToDTO(childRow) : undefined,
                relation,
              });
              break;
            }
            case "detach": {
              await deleteShelfItemChildren(tx, {
                shelfId,
                parentItemId: op.parentItemId,
                parentItemType: op.parentItemType,
                childItemId: op.childItemId,
                childItemType: op.childItemType,
                role: op.role,
              });
              results.push({ status: "ok", op });
              break;
            }
            case "setChildren": {
              const childItemIds = op.childItemIds ?? [];
              if (childItemIds.some((id) => id === op.parentItemId)) {
                results.push({
                  status: "failed",
                  op,
                  reason: "self_relation_forbidden",
                });
                continue;
              }
              for (const childId of childItemIds) {
                const existing = await findShelfItem(
                  tx,
                  shelfId,
                  childId,
                  op.childItemType,
                );
                if (!existing) {
                  const kind = op.childKind ?? (await this.deriveKind(childId));
                  const r = await ensureShelfItem(
                    tx,
                    shelfId,
                    childId,
                    kind,
                    op.childItemType,
                    undefined,
                    op.parentItemId,
                    op.parentItemType,
                    op.role,
                  );
                  if (r.created) mutated = true;
                }
              }
              const existingRelations = await tx
                .select({ childItemId: ShelfItem.itemId })
                .from(ShelfItem)
                .where(
                  and(
                    eq(ShelfItem.shelfId, shelfId),
                    eq(ShelfItem.parentItemType, op.parentItemType),
                    eq(ShelfItem.parentItemId, op.parentItemId),
                    eq(ShelfItem.itemType, op.childItemType),
                    eq(ShelfItem.parentRole, op.role),
                  ),
                );
              const existingSet = new Set(
                existingRelations.map((r) => r.childItemId),
              );
              const nextSet = new Set(childItemIds);
              const toAdd = [...nextSet].filter((id) => !existingSet.has(id));
              const toRemove = [...existingSet].filter(
                (id) => !nextSet.has(id),
              );
              if (toRemove.length > 0) {
                await deleteShelfItemChildren(tx, {
                  shelfId,
                  parentItemId: op.parentItemId,
                  parentItemType: op.parentItemType,
                  childItemType: op.childItemType,
                  role: op.role,
                  childItemIds: toRemove,
                });
              }
              for (const childId of toAdd) {
                await upsertShelfItemChild(tx, {
                  shelfId,
                  parentItemId: op.parentItemId,
                  parentItemType: op.parentItemType,
                  childItemId: childId,
                  childItemType: op.childItemType,
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

    if (touchedItems.size > 0) {
      for (let i = 0; i < results.length; i += 1) {
        const r = results[i]!;
        if (
          r.status === "ok" &&
          (r.op.op === "add" ||
            r.op.op === "reorder" ||
            r.op.op === "reorderToPage")
        ) {
          const opItemId = r.op.itemId;
          const opItemType = touchedItems.get(opItemId);
          if (opItemType) {
            const fresh = await findShelfItem(
              db,
              shelfId,
              opItemId,
              opItemType,
            );
            if (fresh) {
              results[i] = {
                status: "ok",
                op: r.op,
                item: mapShelfItemToDTO(fresh),
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
    orphanItemIds: string[],
  ): Promise<{ deleted: number }> {
    if (orphanItemIds.length === 0) return { deleted: 0 };
    const db = await getServerDb();
    const deleted = await db.transaction(async (tx) => {
      const rows = await tx
        .delete(ShelfItem)
        .where(
          and(
            eq(ShelfItem.shelfId, shelfId),
            inArray(ShelfItem.itemId, orphanItemIds),
          ),
        )
        .returning({
          unitId: ShelfItem.itemId,
          parentItemId: ShelfItem.parentItemId,
        });
      if (rows.length > 0) {
        const rootRows = rows.filter((row) => !row.parentItemId).length;
        await tx
          .update(Shelf)
          .set({
            itemCount: sql`${Shelf.itemCount} - ${rows.length}`,
            ...(rootRows > 0
              ? { rootItemCount: sql`${Shelf.rootItemCount} - ${rootRows}` }
              : {}),
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
): ShelfItemKind {
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
      return type.toString().toLowerCase() as ShelfItemKind;
  }
}

export const shelfService = new ShelfService();
