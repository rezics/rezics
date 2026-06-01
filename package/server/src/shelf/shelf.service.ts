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
import type { Prisma } from "#/prisma/client";
import {
  PostKind,
  prisma,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "#/prisma/client";
import { nullableContentDocJson } from "@/content-doc/prisma-json";
import { getSeedTagId } from "@/infra/seed-tags";
import { serverJobProducer } from "@/job/job-boundary";
import { searchClient } from "@/meili/search-client";
import {
  assertLicenseSlug,
  publicUnitEligibilityWhere,
} from "@/unit/publication-policy";
import { AppError } from "@/utils/errors";
import {
  hydrateUnitOwnerUserSlugRow,
  hydrateUnitOwnerUserSlugs,
} from "@/utils/userSlugHydration";
import {
  generateBetween,
  POSITION_LENGTH_THRESHOLD,
  rebalance,
} from "./fractional-index";
import {
  applyUserUnitCollectionMetadata,
  enqueueUserUnitCollectionSearchSync,
} from "./user-unit-collection.service";

export const SHELF_ITEM_BATCH_OP_CAP = 200;

import {
  mapShelfDetailToDTO,
  mapShelfListRowToDTO,
  mapShelfSummaryToDTO,
  mapShelfToDTO,
  mapShelfUnitRelationToDTO,
  mapShelfUnitToDTO,
} from "./shelf.mapper";
import { isSystemKindKey } from "./system-shelves";
import { shelfInclude, shelfListSelect } from "./types";

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

type Tx = Prisma.TransactionClient;

async function nextShelfPosition(
  tx: Tx | typeof prisma,
  shelfId: string,
): Promise<string> {
  const last = await tx.shelfUnit.findFirst({
    where: { shelfId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  return generateBetween(last?.position, undefined);
}

async function ensureShelfUnit(
  tx: Tx,
  shelfId: string,
  unitId: string,
  kind: ShelfUnitKind,
  variantUnitId?: string | null,
  explicitPosition?: string,
): Promise<{ created: boolean }> {
  const position = explicitPosition ?? (await nextShelfPosition(tx, shelfId));
  const created = await tx.shelfUnit.createMany({
    data: [
      { shelfId, unitId, variantUnitId: variantUnitId ?? null, kind, position },
    ],
    skipDuplicates: true,
  });
  if (created.count === 0 && variantUnitId !== undefined) {
    await tx.shelfUnit.update({
      where: { shelfId_unitId: { shelfId, unitId } },
      data: { variantUnitId },
    });
  }
  if (created.count > 0) {
    await tx.shelf.update({
      where: { unitId: shelfId },
      data: { itemCount: { increment: created.count } },
    });
  }
  return { created: created.count > 0 };
}

async function deleteShelfUnit(
  tx: Tx,
  shelfId: string,
  unitId: string,
): Promise<number> {
  const deleted = await tx.shelfUnit.deleteMany({
    where: { shelfId, unitId },
  });
  if (deleted.count > 0) {
    await tx.shelf.update({
      where: { unitId: shelfId },
      data: { itemCount: { decrement: deleted.count } },
    });
  }
  return deleted.count;
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

    const shelf = await prisma.shelf.findUnique({
      where: { unitId: shelfId },
      select: { unit: { select: { userId: true } } },
    });
    const ownerUserId = shelf?.unit.userId;
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
      const tagRows = await prisma.userTagApplication.findMany({
        where: { userId: ownerUserId, tagUnitId: { in: tagUnitIds } },
        select: { unitId: true, tagUnitId: true },
      });
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

  private async buildWhere(
    options: ShelfListQuery,
  ): Promise<Prisma.ShelfWhereInput> {
    const and: Prisma.ShelfWhereInput[] = [
      { unit: { type: UnitType.SHELF, ...publicUnitEligibilityWhere } },
    ];

    if (options.userId?.trim()) {
      and.push({ unit: { userId: options.userId } });
    }

    if (options.kindKey?.trim()) {
      and.push({ kindKey: options.kindKey });
    }

    const containsUnitId = options.containsUnitId?.trim();
    if (containsUnitId) {
      and.push({
        units: { some: { unitId: containsUnitId } },
      });
    }

    const variantUnitId = options.variantUnitId?.trim();
    if (variantUnitId) {
      and.push({
        units: { some: { variantUnitId } },
      });
    }

    const idList = parseIdsCsv(options.ids);
    if (idList && idList.length > 0) {
      and.push({ unitId: { in: idList } });
    }

    return and.length ? { AND: and } : {};
  }

  private buildOrderBy(
    options: ShelfListQuery,
  ): Prisma.Enumerable<Prisma.ShelfOrderByWithRelationInput> {
    const order = (options.sort?.order ?? "desc") as "asc" | "desc";
    const field = options.sort?.field ?? "createdAt";
    if (field === "updatedAt")
      return [{ unit: { updatedAt: order } }, { unitId: "desc" }];
    return [{ unit: { createdAt: order } }, { unitId: "desc" }];
  }

  async list(
    options: ShelfListQuery = {},
  ): Promise<{ shelves: ShelfDTO[]; total: number }> {
    const limitNum = Math.max(1, Math.min(Number(options.limit ?? 20), 100));
    const hasCursor = Boolean(options.cursor?.unitId);
    const skipNum = hasCursor ? 1 : (options.start ?? 0);
    const where = await this.buildWhere(options);
    const orderBy = this.buildOrderBy(options);

    const [rows, total] = await Promise.all([
      prisma.shelf.findMany({
        where,
        orderBy,
        skip: skipNum,
        cursor: hasCursor ? { unitId: options.cursor!.unitId! } : undefined,
        take: limitNum,
        select: shelfListSelect,
      }),
      prisma.shelf.count({ where }),
    ]);

    const hydratedRows = await hydrateUnitOwnerUserSlugs(rows);
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
      total,
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

    const shelfUnits = await prisma.shelfUnit.findMany({
      where: {
        shelfId: { in: shelfIds },
        ...(containsUnitId ? { unitId: containsUnitId } : {}),
        ...(variantUnitId ? { variantUnitId } : {}),
      },
      orderBy: { position: "asc" },
      select: {
        shelfId: true,
        unitId: true,
        variantUnitId: true,
        kind: true,
      },
    });

    const matchedUnitIds = [
      ...new Set(shelfUnits.map((row) => row.variantUnitId ?? row.unitId)),
    ];
    const units =
      matchedUnitIds.length > 0
        ? await prisma.unit.findMany({
            where: { id: { in: matchedUnitIds } },
            select: {
              id: true,
              defaultLanguage: true,
              translations: { select: { language: true, title: true } },
            },
          })
        : [];
    const unitById = new Map(units.map((unit) => [unit.id, unit]));

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
    const rows = await prisma.shelf.findMany({
      where: { unit: { userId, type: UnitType.SHELF } },
      orderBy: { createdAt: "asc" },
      select: shelfListSelect,
    });
    return (await hydrateUnitOwnerUserSlugs(rows)).map(mapShelfSummaryToDTO);
  }

  async getByUnitId(unitId: string): Promise<ShelfDetailDTO> {
    const row = await prisma.shelf.findFirstOrThrow({
      where: { unitId },
      include: shelfInclude,
    });
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
    const unit = await prisma.unit.findFirst({
      where: {
        type: UnitType.SHELF,
        slug,
        slugScope: ownerUserId,
      },
      select: { id: true },
    });
    if (!unit) return null;
    const row = await prisma.shelf.findUnique({
      where: { unitId: unit.id },
      include: shelfInclude,
    });
    if (!row) return null;
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
        ...(nextExtra !== undefined
          ? { extra: nextExtra as Prisma.InputJsonValue }
          : {}),
      };
    });

    const unit = await prisma.unit.create({
      data: {
        userId,
        slugScope: userId,
        type: UnitType.SHELF,
        status: UnitStatus.PUBLISHED,
        visibility: (visibility as UnitVisibility) ?? UnitVisibility.PUBLIC,
        licenseSlug: assertLicenseSlug(req.licenseSlug) ?? undefined,
        ...(translationData.length
          ? { translations: { create: translationData } }
          : {}),
        ...(tagIds?.length
          ? {
              unitTags: {
                create: tagIds.map((tagUnitId) => ({
                  tagUnitId,
                  score: 0,
                  voteCount: 0,
                  pinned: true,
                })),
              },
            }
          : {}),
      },
    });

    const row = await prisma.shelf.create({
      data: {
        unitId: unit.id,
        kindKey: kindKey ?? undefined,
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: shelfInclude,
    });

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

    if (visibility !== undefined || req.licenseSlug !== undefined) {
      await prisma.unit.update({
        where: { id: unitId },
        data: {
          visibility: (visibility as UnitVisibility | undefined) ?? undefined,
          licenseSlug:
            req.licenseSlug === null
              ? null
              : (assertLicenseSlug(req.licenseSlug) ?? undefined),
        },
      });
    }

    if (title !== undefined || coverUrl !== undefined) {
      const unit = await prisma.unit.findUniqueOrThrow({
        where: { id: unitId },
        select: { defaultLanguage: true },
      });
      const language = unit.defaultLanguage ?? "en";
      const existing = await prisma.unitTranslation.findUnique({
        where: { unitId_language: { unitId, language } },
        select: { extra: true },
      });
      const nextExtra =
        coverUrl !== undefined
          ? (withCoverUrl(
              existing?.extra ?? undefined,
              coverUrl ?? undefined,
            ) as Prisma.InputJsonValue)
          : undefined;
      await prisma.unitTranslation.upsert({
        where: { unitId_language: { unitId, language } },
        create: {
          unitId,
          language,
          title: title ?? undefined,
          ...(nextExtra !== undefined ? { extra: nextExtra } : {}),
        },
        update: {
          ...(title !== undefined ? { title } : {}),
          ...(nextExtra !== undefined ? { extra: nextExtra } : {}),
        },
      });
    }

    const row = await prisma.shelf.update({
      where: { unitId },
      data: {
        kindKey: kindKey !== undefined ? kindKey : undefined,
        extra:
          extra !== undefined
            ? ((extra ?? undefined) as Prisma.InputJsonValue | undefined)
            : undefined,
      },
      include: shelfInclude,
    });

    return mapShelfToDTO(await hydrateUnitOwnerUserSlugRow(row));
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }

  async setPinnedTags(
    shelfUnitId: string,
    pinnedTagIds: readonly string[],
    actorUserId: string,
  ): Promise<SetPinnedTagsResponse> {
    const shelf = await prisma.shelf.findUnique({
      where: { unitId: shelfUnitId },
      select: { unit: { select: { userId: true } } },
    });
    if (!shelf) {
      throw new AppError(404, `Shelf not found: ${shelfUnitId}`);
    }
    if (shelf.unit?.userId !== actorUserId) {
      throw new AppError(
        403,
        "Forbidden: you do not have permission to update this shelf",
      );
    }

    assertOnlySeedTags(pinnedTagIds);

    const desired = new Set(pinnedTagIds);

    const tags = await prisma.$transaction(async (tx) => {
      const existing = await tx.unitTag.findMany({
        where: { unitId: shelfUnitId, pinned: true },
        select: { tagUnitId: true },
      });
      const existingSet = new Set(existing.map((r) => r.tagUnitId));

      const toAdd = [...desired].filter((id) => !existingSet.has(id));
      const toRemove = [...existingSet].filter((id) => !desired.has(id));

      if (toRemove.length > 0) {
        await tx.unitTag.deleteMany({
          where: {
            unitId: shelfUnitId,
            tagUnitId: { in: toRemove },
            pinned: true,
          },
        });
      }
      if (toAdd.length > 0) {
        await tx.unitTag.createMany({
          data: toAdd.map((tagUnitId) => ({
            unitId: shelfUnitId,
            tagUnitId,
            score: 0,
            voteCount: 0,
            pinned: true,
          })),
          skipDuplicates: true,
        });
      }

      const rows = await tx.unitTag.findMany({
        where: { unitId: shelfUnitId, pinned: true },
        select: { tagUnitId: true, score: true },
        orderBy: { score: "desc" },
      });
      return rows.map((r) => ({ tagUnitId: r.tagUnitId, score: r.score }));
    });

    return { tags };
  }

  // --- Shelf unit operations ---

  /**
   * Derive the ShelfUnit kind for a unit at write time.
   */
  async deriveKind(unitId: string): Promise<ShelfUnitKind> {
    const unit = await prisma.unit.findUnique({
      where: { id: unitId },
      select: {
        type: true,
        post: { select: { kind: true } },
      },
    });
    if (!unit) throw new Error(`Unit not found: ${unitId}`);
    return mapUnitToKind(unit.type, unit.post?.kind ?? null);
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

    const row = await prisma.$transaction(async (tx) => {
      await ensureShelfUnit(tx, shelfId, req.unitId, kind, req.variantUnitId);
      if (userId) {
        await applyUserUnitCollectionMetadata(tx, userId, req.unitId, {
          tagUnitIds: req.tagUnitIds,
          searchText: req.searchText,
        });
      }
      return tx.shelfUnit.findUniqueOrThrow({
        where: { shelfId_unitId: { shelfId, unitId: req.unitId } },
      });
    });

    if (userId && req.searchText !== undefined) {
      await enqueueUserUnitCollectionSearchSync(userId, req.unitId);
    }

    await enqueueContainedUnitIdsSync(shelfId);
    return mapShelfUnitToDTO(row);
  }

  async removeUnit(shelfId: string, unitId: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await deleteShelfUnit(tx, shelfId, unitId);
    });
    await enqueueContainedUnitIdsSync(shelfId);
  }

  async reorderUnit(
    shelfId: string,
    unitId: string,
    input: ReorderShelfUnitInput,
  ): Promise<ShelfUnitDTO> {
    const [before, after] = await Promise.all([
      input.beforeUnitId
        ? prisma.shelfUnit.findUnique({
            where: {
              shelfId_unitId: { shelfId, unitId: input.beforeUnitId },
            },
            select: { position: true },
          })
        : Promise.resolve(null),
      input.afterUnitId
        ? prisma.shelfUnit.findUnique({
            where: {
              shelfId_unitId: { shelfId, unitId: input.afterUnitId },
            },
            select: { position: true },
          })
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

    const row = await prisma.shelfUnit.update({
      where: { shelfId_unitId: { shelfId, unitId } },
      data: { position: candidate },
    });
    return mapShelfUnitToDTO(row);
  }

  private async rebalanceWindow(
    shelfId: string,
    movedUnitId: string,
    beforeUnitId: string | undefined,
    afterUnitId: string | undefined,
  ): Promise<ShelfUnitDTO> {
    const rows = await prisma.shelfUnit.findMany({
      where: { shelfId },
      orderBy: { position: "asc" },
      take: REBALANCE_WINDOW,
      select: { unitId: true },
    });

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

    await prisma.$transaction(
      ids.map((id, idx) =>
        prisma.shelfUnit.update({
          where: { shelfId_unitId: { shelfId, unitId: id } },
          data: { position: newPositions[idx]! },
        }),
      ),
    );

    const moved = await prisma.shelfUnit.findUniqueOrThrow({
      where: { shelfId_unitId: { shelfId, unitId: movedUnitId } },
    });
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

    const cursor = query.cursor
      ? { shelfId_unitId: { shelfId, unitId: query.cursor } }
      : undefined;

    const units = await prisma.shelfUnit.findMany({
      where: {
        shelfId,
        ...(query.variantUnitId?.trim()
          ? { variantUnitId: query.variantUnitId.trim() }
          : {}),
        ...(searchIds ? { unitId: { in: [...searchIds] } } : {}),
      },
      orderBy: { position: "asc" },
      cursor,
      skip: cursor ? 1 : 0,
      take: limit + 1,
    });

    const hasMore = units.length > limit;
    const page = hasMore ? units.slice(0, limit) : units;
    const unitIds = page.map((p) => p.unitId);

    const relations =
      unitIds.length > 0
        ? await prisma.shelfUnitRelation.findMany({
            where: {
              shelfId,
              OR: [
                { parentUnitId: { in: unitIds } },
                { childUnitId: { in: unitIds } },
              ],
            },
          })
        : [];

    return {
      units: page.map(mapShelfUnitToDTO),
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
    const relation = await prisma.$transaction(async (tx) => {
      const parent = await tx.shelfUnit.findUnique({
        where: { shelfId_unitId: { shelfId, unitId: parentUnitId } },
      });
      if (!parent) {
        const parentKind = await this.deriveKind(parentUnitId);
        await ensureShelfUnit(tx, shelfId, parentUnitId, parentKind);
      }

      const child = await tx.shelfUnit.findUnique({
        where: { shelfId_unitId: { shelfId, unitId: reviewUnitId } },
      });
      if (!child) {
        const r = await ensureShelfUnit(tx, shelfId, reviewUnitId, reviewKind);
        didCreateChild = r.created;
      }

      return tx.shelfUnitRelation.upsert({
        where: {
          shelfId_parentUnitId_childUnitId_role: {
            shelfId,
            parentUnitId,
            childUnitId: reviewUnitId,
            role: "review",
          },
        },
        create: {
          shelfId,
          parentUnitId,
          childUnitId: reviewUnitId,
          role: "review",
        },
        update: {},
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
    await prisma.shelfUnitRelation.deleteMany({
      where: {
        shelfId,
        parentUnitId,
        childUnitId: reviewUnitId,
        role: "review",
      },
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
    await prisma.$transaction(async (tx) => {
      const parent = await tx.shelfUnit.findUnique({
        where: { shelfId_unitId: { shelfId, unitId: parentUnitId } },
      });
      if (!parent) {
        const parentKind = await this.deriveKind(parentUnitId);
        await ensureShelfUnit(tx, shelfId, parentUnitId, parentKind);
      }

      for (const childId of childUnitIds) {
        const existing = await tx.shelfUnit.findUnique({
          where: { shelfId_unitId: { shelfId, unitId: childId } },
        });
        if (!existing) {
          const kind = childKind ?? (await this.deriveKind(childId));
          const r = await ensureShelfUnit(tx, shelfId, childId, kind);
          didCreate = didCreate || r.created;
        }
      }

      const existingRelations = await tx.shelfUnitRelation.findMany({
        where: { shelfId, parentUnitId, role },
        select: { childUnitId: true },
      });
      const existingSet = new Set(existingRelations.map((r) => r.childUnitId));
      const nextSet = new Set(childUnitIds);

      const toAdd = [...nextSet].filter((id) => !existingSet.has(id));
      const toRemove = [...existingSet].filter((id) => !nextSet.has(id));

      if (toRemove.length > 0) {
        await tx.shelfUnitRelation.deleteMany({
          where: {
            shelfId,
            parentUnitId,
            role,
            childUnitId: { in: toRemove },
          },
        });
      }
      for (const childId of toAdd) {
        await tx.shelfUnitRelation.create({
          data: { shelfId, parentUnitId, childUnitId: childId, role },
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

    await prisma.$transaction(async (tx) => {
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
              const row = await tx.shelfUnit.findUniqueOrThrow({
                where: { shelfId_unitId: { shelfId, unitId: op.unitId } },
              });
              touchedUnitIds.add(op.unitId);
              results.push({
                status: "ok",
                op,
                unit: mapShelfUnitToDTO(row),
              });
              break;
            }
            case "reorder": {
              const row = await tx.shelfUnit.update({
                where: { shelfId_unitId: { shelfId, unitId: op.unitId } },
                data: { position: op.position },
              });
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
              const rows = await tx.shelfUnit.findMany({
                where: { shelfId, unitId: { not: op.unitId } },
                orderBy: { position: order },
                skip: Math.max(0, skip - 1),
                take: skip === 0 ? 1 : 2,
                select: { position: true },
              });
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
              const row = await tx.shelfUnit.update({
                where: { shelfId_unitId: { shelfId, unitId: op.unitId } },
                data: { position: newPosition },
              });
              touchedUnitIds.add(op.unitId);
              results.push({
                status: "ok",
                op,
                unit: mapShelfUnitToDTO(row),
              });
              break;
            }
            case "delete": {
              const deleted = await tx.shelfUnit.deleteMany({
                where: { shelfId, unitId: op.unitId },
              });
              if (deleted.count > 0) {
                await tx.shelf.update({
                  where: { unitId: shelfId },
                  data: { itemCount: { decrement: deleted.count } },
                });
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
              const existingChild = await tx.shelfUnit.findUnique({
                where: {
                  shelfId_unitId: { shelfId, unitId: op.childUnitId },
                },
              });
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
              const relation = await tx.shelfUnitRelation.upsert({
                where: {
                  shelfId_parentUnitId_childUnitId_role: {
                    shelfId,
                    parentUnitId: op.parentUnitId,
                    childUnitId: op.childUnitId,
                    role: op.role,
                  },
                },
                create: {
                  shelfId,
                  parentUnitId: op.parentUnitId,
                  childUnitId: op.childUnitId,
                  role: op.role,
                },
                update: {},
              });
              touchedUnitIds.add(op.childUnitId);
              const childRow = await tx.shelfUnit.findUnique({
                where: {
                  shelfId_unitId: { shelfId, unitId: op.childUnitId },
                },
              });
              results.push({
                status: "ok",
                op,
                unit: childRow ? mapShelfUnitToDTO(childRow) : undefined,
                relation: mapShelfUnitRelationToDTO(relation),
              });
              break;
            }
            case "detach": {
              await tx.shelfUnitRelation.deleteMany({
                where: {
                  shelfId,
                  parentUnitId: op.parentUnitId,
                  childUnitId: op.childUnitId,
                  role: op.role,
                },
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
                const existing = await tx.shelfUnit.findUnique({
                  where: { shelfId_unitId: { shelfId, unitId: childId } },
                });
                if (!existing) {
                  const kind = op.childKind ?? (await this.deriveKind(childId));
                  const r = await ensureShelfUnit(tx, shelfId, childId, kind);
                  if (r.created) mutated = true;
                }
              }
              const existingRelations = await tx.shelfUnitRelation.findMany({
                where: {
                  shelfId,
                  parentUnitId: op.parentUnitId,
                  role: op.role,
                },
                select: { childUnitId: true },
              });
              const existingSet = new Set(
                existingRelations.map((r) => r.childUnitId),
              );
              const nextSet = new Set(op.childUnitIds);
              const toAdd = [...nextSet].filter((id) => !existingSet.has(id));
              const toRemove = [...existingSet].filter(
                (id) => !nextSet.has(id),
              );
              if (toRemove.length > 0) {
                await tx.shelfUnitRelation.deleteMany({
                  where: {
                    shelfId,
                    parentUnitId: op.parentUnitId,
                    role: op.role,
                    childUnitId: { in: toRemove },
                  },
                });
              }
              for (const childId of toAdd) {
                await tx.shelfUnitRelation.create({
                  data: {
                    shelfId,
                    parentUnitId: op.parentUnitId,
                    childUnitId: childId,
                    role: op.role,
                  },
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
            const fresh = await prisma.shelfUnit.findUnique({
              where: { shelfId_unitId: { shelfId, unitId: opUnitId } },
            });
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
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.shelfUnit.deleteMany({
        where: { shelfId, unitId: { in: orphanUnitIds } },
      });
      if (deleted.count > 0) {
        await tx.shelf.update({
          where: { unitId: shelfId },
          data: { itemCount: { decrement: deleted.count } },
        });
      }
      return deleted;
    });
    if (result.count > 0) {
      await enqueueContainedUnitIdsSync(shelfId);
    }
    return { deleted: result.count };
  }
}

export function mapUnitToKind(
  type: UnitType,
  postKind: PostKind | null,
): ShelfUnitKind {
  if (type === UnitType.POST) {
    if (postKind === PostKind.CHAPTER) return "chapter";
    if (postKind === PostKind.REVIEW) return "review";
    if (postKind === PostKind.EXCERPT) return "quote";
    return "post";
  }
  switch (type) {
    case UnitType.BOOK:
      return "book";
    case UnitType.TAG:
      return "tag";
    case UnitType.REALM:
      return "realm";
    case UnitType.SHELF:
      return "shelf";
    case UnitType.LINK:
      return "link";
    case UnitType.GAME:
      return "game";
    case UnitType.MEDIA:
      return "media";
    case UnitType.IMAGE:
      return "image";
    case UnitType.VIDEO:
      return "video";
    default:
      return type.toString().toLowerCase() as ShelfUnitKind;
  }
}

export const shelfService = new ShelfService();
