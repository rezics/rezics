import type {
  AddShelfItemInput,
  CreateShelfInput,
  ReorderShelfItemInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemsQuery,
  ShelfListQuery,
  ShelfSummaryDTO,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "@rezics/contract";
import { parseIdsCsv } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import {
  PostKind,
  prisma,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "#/prisma/client";
import {
  generateBetween,
  POSITION_LENGTH_THRESHOLD,
  rebalance,
} from "./fractional-index";
import {
  mapShelfDetailToDTO,
  mapShelfItemToDTO,
  mapShelfListRowToDTO,
  mapShelfSummaryToDTO,
  mapShelfToDTO,
} from "./shelf.mapper";
import { shelfInclude, shelfListSelect } from "./types";

const REBALANCE_WINDOW = 50;

export class ShelfService {
  private buildWhere(options: ShelfListQuery): Prisma.ShelfWhereInput {
    const and: Prisma.ShelfWhereInput[] = [{ unit: { type: UnitType.SHELF } }];

    if (options.userId?.trim()) {
      and.push({ unit: { userId: options.userId } });
    }

    if (options.kindKey?.trim()) {
      and.push({ kindKey: options.kindKey });
    }

    if (options.containsItemRef?.trim()) {
      and.push({
        items: { some: { itemRef: options.containsItemRef } },
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
    const where = this.buildWhere(options);
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

    return { shelves: rows.map(mapShelfListRowToDTO), total };
  }

  async listUserShelves(userId: string): Promise<ShelfSummaryDTO[]> {
    const rows = await prisma.shelf.findMany({
      where: { unit: { userId, type: UnitType.SHELF } },
      orderBy: { createdAt: "asc" },
      select: shelfListSelect,
    });
    return rows.map(mapShelfSummaryToDTO);
  }

  async getByUnitId(unitId: string): Promise<ShelfDetailDTO> {
    const [row, itemCount] = await Promise.all([
      prisma.shelf.findFirstOrThrow({
        where: { unitId },
        include: shelfInclude,
      }),
      prisma.shelfItem.count({ where: { shelfUnitId: unitId } }),
    ]);
    return mapShelfDetailToDTO(row, itemCount);
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

    const translationData = translations?.length
      ? translations
      : title
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

    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.SHELF,
        status: UnitStatus.PUBLISHED,
        visibility: (visibility as UnitVisibility) ?? UnitVisibility.PUBLIC,
        ...(translationData.length
          ? {
              translations: {
                create: translationData.map((tr) => ({
                  language: tr.language,
                  title: tr.title,
                  subtitle: tr.subtitle,
                  summary: tr.summary,
                  description: tr.description,
                })),
              },
            }
          : {}),
        ...(tagIds?.length
          ? {
              unitTags: {
                create: tagIds.map((tagUnitId) => ({
                  tagUnitId,
                  score: 0,
                  voteCount: 0,
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
        coverUrl: coverUrl ?? undefined,
        extra: (extra ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: shelfInclude,
    });

    return mapShelfToDTO(row);
  }

  async update(unitId: string, req: UpdateShelfInput): Promise<ShelfDTO> {
    const { kindKey, coverUrl, visibility, extra, title } = req;

    if (visibility !== undefined) {
      await prisma.unit.update({
        where: { id: unitId },
        data: { visibility: visibility as UnitVisibility },
      });
    }

    if (title !== undefined) {
      await prisma.unitTranslation.upsert({
        where: { unitId_language: { unitId, language: "en" } },
        update: { title },
        create: { unitId, language: "en", title },
      });
    }

    const row = await prisma.shelf.update({
      where: { unitId },
      data: {
        kindKey: kindKey !== undefined ? kindKey : undefined,
        coverUrl: coverUrl !== undefined ? coverUrl : undefined,
        extra:
          extra !== undefined
            ? ((extra ?? undefined) as Prisma.InputJsonValue | undefined)
            : undefined,
      },
      include: shelfInclude,
    });

    return mapShelfToDTO(row);
  }

  async delete(unitId: string): Promise<void> {
    await prisma.unit.delete({ where: { id: unitId } });
  }

  // --- Shelf item operations ---

  /**
   * Derive the ShelfItem kind for a unit at write time.
   * Looks up Unit.type, and for POST units also checks Post.kind.
   */
  async deriveKind(unitId: string): Promise<ShelfItemKind> {
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

  async addItem(
    shelfUnitId: string,
    req: AddShelfItemInput,
  ): Promise<ShelfItemDTO> {
    const kind = req.kind ?? (await this.deriveKind(req.itemRef));

    // Find the current max position in this shelf for append.
    const last = await prisma.shelfItem.findFirst({
      where: { shelfUnitId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = generateBetween(last?.position, undefined);

    const item = await prisma.shelfItem.upsert({
      where: {
        shelfUnitId_itemRef: { shelfUnitId, itemRef: req.itemRef },
      },
      create: {
        shelfUnitId,
        itemRef: req.itemRef,
        kind,
        position,
        reviewIds: req.reviewIds ?? [],
        tagIds: req.tagIds ?? [],
      },
      update: {
        // On re-add (already present), only extend arrays.
        reviewIds: req.reviewIds
          ? { set: Array.from(new Set([...(req.reviewIds ?? [])])) }
          : undefined,
        tagIds: req.tagIds !== undefined ? { set: req.tagIds } : undefined,
      },
    });

    return mapShelfItemToDTO(item);
  }

  async updateItem(
    shelfUnitId: string,
    itemRef: string,
    req: UpdateShelfItemInput,
  ): Promise<ShelfItemDTO> {
    const existing = await prisma.shelfItem.findUniqueOrThrow({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
      select: { reviewIds: true },
    });

    let reviewIds: string[] | undefined;
    if (req.addReviewIds?.length || req.removeReviewIds?.length) {
      const remove = new Set(req.removeReviewIds ?? []);
      const merged = new Set(
        existing.reviewIds.filter((id) => !remove.has(id)),
      );
      for (const id of req.addReviewIds ?? []) merged.add(id);
      reviewIds = Array.from(merged);
    }

    const item = await prisma.shelfItem.update({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
      data: {
        reviewIds: reviewIds !== undefined ? { set: reviewIds } : undefined,
        tagIds: req.tagIds !== undefined ? { set: req.tagIds } : undefined,
      },
    });

    return mapShelfItemToDTO(item);
  }

  async removeItem(shelfUnitId: string, itemRef: string): Promise<void> {
    await prisma.shelfItem.delete({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
    });
  }

  async reorderItem(
    shelfUnitId: string,
    itemRef: string,
    input: ReorderShelfItemInput,
  ): Promise<ShelfItemDTO> {
    const [before, after] = await Promise.all([
      input.beforeItemRef
        ? prisma.shelfItem.findUnique({
            where: {
              shelfUnitId_itemRef: {
                shelfUnitId,
                itemRef: input.beforeItemRef,
              },
            },
            select: { position: true },
          })
        : Promise.resolve(null),
      input.afterItemRef
        ? prisma.shelfItem.findUnique({
            where: {
              shelfUnitId_itemRef: {
                shelfUnitId,
                itemRef: input.afterItemRef,
              },
            },
            select: { position: true },
          })
        : Promise.resolve(null),
    ]);

    const candidate = generateBetween(before?.position, after?.position);

    if (candidate.length > POSITION_LENGTH_THRESHOLD) {
      return await this.rebalanceWindow(
        shelfUnitId,
        itemRef,
        input.beforeItemRef,
        input.afterItemRef,
      );
    }

    const item = await prisma.shelfItem.update({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
      data: { position: candidate },
    });

    return mapShelfItemToDTO(item);
  }

  private async rebalanceWindow(
    shelfUnitId: string,
    movedItemRef: string,
    beforeItemRef: string | undefined,
    afterItemRef: string | undefined,
  ): Promise<ShelfItemDTO> {
    // Read the full shelf (capped by REBALANCE_WINDOW) and redistribute positions evenly.
    const rows = await prisma.shelfItem.findMany({
      where: { shelfUnitId },
      orderBy: { position: "asc" },
      take: REBALANCE_WINDOW,
      select: { itemRef: true },
    });

    // Remove the moving item then insert it between before/after in the sequence.
    const refs = rows.map((r) => r.itemRef).filter((r) => r !== movedItemRef);
    let insertAt = refs.length;
    if (beforeItemRef) {
      const idx = refs.indexOf(beforeItemRef);
      if (idx >= 0) insertAt = idx + 1;
    } else if (afterItemRef) {
      const idx = refs.indexOf(afterItemRef);
      if (idx >= 0) insertAt = idx;
      else insertAt = 0;
    } else {
      insertAt = refs.length;
    }
    refs.splice(insertAt, 0, movedItemRef);

    const newPositions = rebalance(refs.length);

    await prisma.$transaction(
      refs.map((ref, idx) =>
        prisma.shelfItem.update({
          where: { shelfUnitId_itemRef: { shelfUnitId, itemRef: ref } },
          data: { position: newPositions[idx]! },
        }),
      ),
    );

    const moved = await prisma.shelfItem.findUniqueOrThrow({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef: movedItemRef } },
    });
    return mapShelfItemToDTO(moved);
  }

  async getShelfItems(
    shelfUnitId: string,
    query: ShelfItemsQuery = {},
  ): Promise<{ items: ShelfItemDTO[]; hasMore: boolean }> {
    const limit = Math.max(1, Math.min(Number(query.limit ?? 100), 100));

    const cursor = query.cursor
      ? {
          shelfUnitId_itemRef: { shelfUnitId, itemRef: query.cursor },
        }
      : undefined;

    const items = await prisma.shelfItem.findMany({
      where: { shelfUnitId },
      orderBy: { position: "asc" },
      cursor,
      skip: cursor ? 1 : 0,
      take: limit + 1,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    return { items: page.map(mapShelfItemToDTO), hasMore };
  }

  // --- Review attachment (reviewIds array mutations) ---

  async attachReview(
    shelfUnitId: string,
    itemRef: string,
    reviewUnitId: string,
    fallbackKind?: ShelfItemKind,
  ): Promise<ShelfItemDTO> {
    const existing = await prisma.shelfItem.findUnique({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
    });

    if (existing) {
      if (existing.reviewIds.includes(reviewUnitId)) {
        return mapShelfItemToDTO(existing);
      }
      const updated = await prisma.shelfItem.update({
        where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
        data: { reviewIds: { set: [...existing.reviewIds, reviewUnitId] } },
      });
      return mapShelfItemToDTO(updated);
    }

    // Create the slot first (kind derived, appended at end).
    const kind = fallbackKind ?? (await this.deriveKind(itemRef));
    const last = await prisma.shelfItem.findFirst({
      where: { shelfUnitId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = generateBetween(last?.position, undefined);

    const created = await prisma.shelfItem.create({
      data: {
        shelfUnitId,
        itemRef,
        kind,
        position,
        reviewIds: [reviewUnitId],
        tagIds: [],
      },
    });
    return mapShelfItemToDTO(created);
  }

  async detachReview(
    shelfUnitId: string,
    itemRef: string,
    reviewUnitId: string,
  ): Promise<ShelfItemDTO> {
    const existing = await prisma.shelfItem.findUniqueOrThrow({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
    });
    const next = existing.reviewIds.filter((id) => id !== reviewUnitId);
    const updated = await prisma.shelfItem.update({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
      data: { reviewIds: { set: next } },
    });
    return mapShelfItemToDTO(updated);
  }

  async setItemTags(
    shelfUnitId: string,
    itemRef: string,
    tagIds: string[],
  ): Promise<ShelfItemDTO> {
    const updated = await prisma.shelfItem.update({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
      data: { tagIds: { set: tagIds } },
    });
    return mapShelfItemToDTO(updated);
  }

  async cleanupOrphans(
    shelfUnitId: string,
    orphanItemRefs: string[],
  ): Promise<{ deleted: number }> {
    if (orphanItemRefs.length === 0) return { deleted: 0 };
    const result = await prisma.shelfItem.deleteMany({
      where: { shelfUnitId, itemRef: { in: orphanItemRefs } },
    });
    return { deleted: result.count };
  }
}

export function mapUnitToKind(
  type: UnitType,
  postKind: PostKind | null,
): ShelfItemKind {
  if (type === UnitType.POST) {
    if (postKind === PostKind.REVIEW) return "review";
    if (postKind === PostKind.QUOTE) return "quote";
    return "post";
  }
  switch (type) {
    case UnitType.BOOK:
      return "book";
    case UnitType.TAG:
      return "tag";
    case UnitType.REALM:
      return "realm";
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
    case UnitType.CHAPTER:
      return "chapter";
    default:
      return type.toString().toLowerCase() as ShelfItemKind;
  }
}

export const shelfService = new ShelfService();
