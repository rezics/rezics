import type {
  AddShelfItemInput,
  CreateShelfInput,
  ReorderShelfItemsInput,
  ShelfDTO,
  ShelfDetailDTO,
  ShelfItemDTO,
  ShelfItemsQuery,
  ShelfListQuery,
  ShelfSummaryDTO,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType, UnitVisibility } from "#/prisma/client";
import {
  mapShelfDetailToDTO,
  mapShelfItemToDTO,
  mapShelfListRowToDTO,
  mapShelfSummaryToDTO,
  mapShelfToDTO,
} from "./shelf.mapper";
import { shelfInclude, shelfItemInclude, shelfListSelect } from "./types";

export class ShelfService {
  private buildWhere(options: ShelfListQuery): Prisma.ShelfWhereInput {
    const and: Prisma.ShelfWhereInput[] = [
      { unit: { type: UnitType.SHELF } },
    ];

    if (options.userId?.trim()) {
      and.push({ unit: { userId: options.userId } });
    }

    if (options.kindKey?.trim()) {
      and.push({ kindKey: options.kindKey });
    }

    if (options.containsItemUnitId?.trim()) {
      and.push({
        items: { some: { itemUnitId: options.containsItemUnitId } },
      });
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
    const { title, kindKey, coverUrl, visibility, tagIds, extra, translations } = req;

    const translationData = translations?.length
      ? translations
      : title
        ? [{ language: "en", title }]
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

  async addItem(
    shelfUnitId: string,
    req: AddShelfItemInput,
  ): Promise<ShelfItemDTO> {
    const item = await prisma.shelfItem.upsert({
      where: {
        shelfUnitId_itemUnitId: {
          shelfUnitId,
          itemUnitId: req.itemUnitId,
        },
      },
      create: {
        shelfUnitId,
        itemUnitId: req.itemUnitId,
        sortOrder: req.sortOrder ?? 0,
        keywords: req.keywords ?? [],
        label: req.label ?? undefined,
        extra: (req.extra ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      update: {
        keywords: req.keywords
          ? {
              // Merge new keywords with existing (deduplicated at app level)
              set: req.keywords,
            }
          : undefined,
      },
      include: shelfItemInclude,
    });

    return mapShelfItemToDTO(item);
  }

  async updateItem(
    shelfUnitId: string,
    itemUnitId: string,
    req: UpdateShelfItemInput,
  ): Promise<ShelfItemDTO> {
    const item = await prisma.shelfItem.update({
      where: {
        shelfUnitId_itemUnitId: { shelfUnitId, itemUnitId },
      },
      data: {
        sortOrder: req.sortOrder,
        keywords: req.keywords !== undefined ? req.keywords : undefined,
        label: req.label !== undefined ? req.label : undefined,
        extra:
          req.extra !== undefined
            ? ((req.extra ?? undefined) as Prisma.InputJsonValue | undefined)
            : undefined,
      },
      include: shelfItemInclude,
    });

    return mapShelfItemToDTO(item);
  }

  async removeItem(shelfUnitId: string, itemUnitId: string): Promise<void> {
    await prisma.shelfItem.delete({
      where: {
        shelfUnitId_itemUnitId: { shelfUnitId, itemUnitId },
      },
    });
  }

  async reorderItems(
    shelfUnitId: string,
    input: ReorderShelfItemsInput,
  ): Promise<void> {
    await prisma.$transaction(
      input.items.map(({ itemUnitId, sortOrder }) =>
        prisma.shelfItem.update({
          where: { shelfUnitId_itemUnitId: { shelfUnitId, itemUnitId } },
          data: { sortOrder },
        }),
      ),
    );
  }

  // --- Review attachment ---

  async attachReview(
    shelfUnitId: string,
    itemUnitId: string,
    reviewUnitId: string,
  ): Promise<void> {
    await prisma.shelfItemReview.create({
      data: { shelfUnitId, itemUnitId, reviewUnitId },
    });
  }

  async detachReview(
    shelfUnitId: string,
    itemUnitId: string,
    reviewUnitId: string,
  ): Promise<void> {
    await prisma.shelfItemReview.delete({
      where: {
        shelfUnitId_itemUnitId_reviewUnitId: {
          shelfUnitId,
          itemUnitId,
          reviewUnitId,
        },
      },
    });
  }

  // --- Shelf items query with filters ---

  async getShelfItems(
    shelfUnitId: string,
    userId: string,
    query: ShelfItemsQuery = {},
  ): Promise<{ items: ShelfItemDTO[]; hasMore: boolean }> {
    const limit = Math.max(1, Math.min(Number(query.limit ?? 20), 100));
    const where: Prisma.ShelfItemWhereInput = { shelfUnitId };

    // Keyword filter
    if (query.keyword?.trim()) {
      where.keywords = { has: query.keyword.trim() };
    }

    // Created/collected filter
    if (query.filter === "created") {
      where.item = {
        OR: [
          { post: { authorUserId: userId } },
          { personCredits: { some: {} } },
          { userId },
        ],
      };
    } else if (query.filter === "collected") {
      where.item = {
        AND: [
          { NOT: { post: { authorUserId: userId } } },
          { NOT: { userId } },
        ],
      };
    }

    // Sort
    let orderBy: Prisma.ShelfItemOrderByWithRelationInput;
    if (query.sort === "oldest") {
      orderBy = { createdAt: "asc" };
    } else if (query.sort === "manual") {
      orderBy = { sortOrder: "asc" };
    } else {
      orderBy = { createdAt: "desc" };
    }

    // Cursor
    const cursor = query.cursor
      ? {
          shelfUnitId_itemUnitId: {
            shelfUnitId,
            itemUnitId: query.cursor,
          },
        }
      : undefined;

    const items = await prisma.shelfItem.findMany({
      where,
      orderBy,
      cursor,
      skip: cursor ? 1 : 0,
      take: limit + 1,
      include: shelfItemInclude,
    });

    const hasMore = items.length > limit;
    const page = hasMore ? items.slice(0, limit) : items;

    return {
      items: page.map(mapShelfItemToDTO),
      hasMore,
    };
  }
}

export const shelfService = new ShelfService();
