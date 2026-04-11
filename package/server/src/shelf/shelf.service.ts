import type {
  AddShelfItemInput,
  CreateShelfInput,
  ShelfDTO,
  ShelfItemDTO,
  ShelfListQuery,
  UpdateShelfInput,
  UpdateShelfItemInput,
} from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import { prisma, UnitStatus, UnitType } from "#/prisma/client";
import { mapShelfItemToDTO, mapShelfListRowToDTO, mapShelfToDTO } from "./shelf.mapper";
import { shelfInclude, shelfListSelect } from "./types";

export class ShelfService {
  private buildWhere(options: ShelfListQuery): Prisma.ShelfWhereInput {
    const and: Prisma.ShelfWhereInput[] = [
      { unit: { status: UnitStatus.ACTIVE, type: UnitType.SHELF } },
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

  async getByUnitId(unitId: string): Promise<ShelfDTO> {
    const row = await prisma.shelf.findFirstOrThrow({
      where: { unitId },
      include: shelfInclude,
    });
    return mapShelfToDTO(row);
  }

  async create(req: CreateShelfInput, userId: string): Promise<ShelfDTO> {
    const { kindKey, extra, translations } = req;

    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.SHELF,
        status: UnitStatus.ACTIVE,
        ...(translations?.length
          ? {
              translations: {
                create: translations.map((tr) => ({
                  language: tr.language,
                  title: tr.title,
                  subtitle: tr.subtitle,
                  summary: tr.summary,
                  description: tr.description,
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

    return mapShelfToDTO(row);
  }

  async update(unitId: string, req: UpdateShelfInput): Promise<ShelfDTO> {
    const { kindKey, extra } = req;

    const row = await prisma.shelf.update({
      where: { unitId },
      data: {
        kindKey: kindKey !== undefined ? kindKey : undefined,
        extra: extra !== undefined
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
    const item = await prisma.shelfItem.create({
      data: {
        shelfUnitId,
        itemUnitId: req.itemUnitId,
        sortOrder: req.sortOrder ?? 0,
        reviewPostUnitId: req.reviewPostUnitId ?? undefined,
        label: req.label ?? undefined,
        extra: (req.extra ?? undefined) as Prisma.InputJsonValue | undefined,
      },
      include: {
        item: { include: { user: true, translations: true } },
        reviewPost: true,
      },
    });

    return mapShelfItemToDTO(item as any);
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
        reviewPostUnitId:
          req.reviewPostUnitId !== undefined
            ? req.reviewPostUnitId
            : undefined,
        label: req.label !== undefined ? req.label : undefined,
        extra: req.extra !== undefined
          ? ((req.extra ?? undefined) as Prisma.InputJsonValue | undefined)
          : undefined,
      },
      include: {
        item: { include: { user: true, translations: true } },
        reviewPost: true,
      },
    });

    return mapShelfItemToDTO(item as any);
  }

  async removeItem(
    shelfUnitId: string,
    itemUnitId: string,
  ): Promise<void> {
    await prisma.shelfItem.delete({
      where: {
        shelfUnitId_itemUnitId: { shelfUnitId, itemUnitId },
      },
    });
  }
}

export const shelfService = new ShelfService();
