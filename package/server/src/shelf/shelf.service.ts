import type {
  AddShelfItemInput,
  CreateShelfInput,
  ReorderShelfItemInput,
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemBatchOp,
  ShelfItemBatchResult,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfItemsQuery,
  ShelfListQuery,
  ShelfSummaryDTO,
  UpdateShelfInput,
} from "@rezics/contract";
import { parseIdsCsv, withCoverUrl } from "@rezics/contract";
import type { Prisma } from "#/prisma/client";
import {
  PostKind,
  prisma,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "#/prisma/client";
import { patchContentContainedUnitIdsToMeili } from "@/meili/content/sync";
import { AppError } from "@/utils/errors";
import {
  generateBetween,
  POSITION_LENGTH_THRESHOLD,
  rebalance,
} from "./fractional-index";

export const SHELF_ITEM_BATCH_OP_CAP = 200;
const CROSS_PAGE_PAGE_SIZE = 100;
import {
  buildShelfItemProjection,
  mapShelfDetailToDTO,
  mapShelfItemToDTO,
  mapShelfListRowToDTO,
  mapShelfSummaryToDTO,
  mapShelfToDTO,
} from "./shelf.mapper";
import { isSystemKindKey } from "./system-shelves";
import { shelfInclude, shelfListSelect } from "./types";

const REBALANCE_WINDOW = 50;

async function syncContainedUnitIdsToMeili(shelfUnitId: string): Promise<void> {
  try {
    await patchContentContainedUnitIdsToMeili(shelfUnitId);
  } catch (error) {
    console.error("[shelf] containedUnitIds meili sync failed", {
      shelfUnitId,
      error,
    });
  }
}

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
    const row = await prisma.shelf.findFirstOrThrow({
      where: { unitId },
      include: shelfInclude,
    });
    return mapShelfDetailToDTO(row, row.itemCount);
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
        description: tr.description,
        ...(nextExtra !== undefined
          ? { extra: nextExtra as Prisma.InputJsonValue }
          : {}),
      };
    });

    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.SHELF,
        status: UnitStatus.PUBLISHED,
        visibility: (visibility as UnitVisibility) ?? UnitVisibility.PUBLIC,
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
    const { kindKey, coverUrl, visibility, extra, title } = req;

    if (visibility !== undefined) {
      await prisma.unit.update({
        where: { id: unitId },
        data: { visibility: visibility as UnitVisibility },
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
    if (shelfUnitId === req.itemRef) {
      throw new AppError(400, "A shelf cannot contain itself");
    }

    const kind = req.kind ?? (await this.deriveKind(req.itemRef));

    const last = await prisma.shelfItem.findFirst({
      where: { shelfUnitId },
      orderBy: { position: "desc" },
      select: { position: true },
    });

    const position = generateBetween(last?.position, undefined);

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.shelfItem.createMany({
        data: [{ shelfUnitId, itemRef: req.itemRef, kind, position }],
        skipDuplicates: true,
      });

      if (created.count > 0) {
        await tx.shelf.update({
          where: { unitId: shelfUnitId },
          data: { itemCount: { increment: 1 } },
        });
      }

      const slot = await tx.shelfItem.findUniqueOrThrow({
        where: { shelfUnitId_itemRef: { shelfUnitId, itemRef: req.itemRef } },
      });

      await tx.shelfUnit.upsert({
        where: {
          shelfUnitId_itemRef_unitId_role: {
            shelfUnitId,
            itemRef: req.itemRef,
            unitId: req.itemRef,
            role: "primary",
          },
        },
        create: {
          shelfUnitId,
          itemRef: req.itemRef,
          unitId: req.itemRef,
          role: "primary",
        },
        update: {},
      });

      for (const reviewId of req.reviewIds ?? []) {
        await tx.shelfUnit.upsert({
          where: {
            shelfUnitId_itemRef_unitId_role: {
              shelfUnitId,
              itemRef: req.itemRef,
              unitId: reviewId,
              role: "review",
            },
          },
          create: {
            shelfUnitId,
            itemRef: req.itemRef,
            unitId: reviewId,
            role: "review",
          },
          update: {},
        });
      }

      for (const tagId of req.tagIds ?? []) {
        await tx.shelfUnit.upsert({
          where: {
            shelfUnitId_itemRef_unitId_role: {
              shelfUnitId,
              itemRef: req.itemRef,
              unitId: tagId,
              role: "tag",
            },
          },
          create: {
            shelfUnitId,
            itemRef: req.itemRef,
            unitId: tagId,
            role: "tag",
          },
          update: {},
        });
      }

      return slot;
    });

    const projection = await buildShelfItemProjection(shelfUnitId, [
      req.itemRef,
    ]);
    await syncContainedUnitIdsToMeili(shelfUnitId);
    return mapShelfItemToDTO(item, projection.get(req.itemRef));
  }

  async removeItem(shelfUnitId: string, itemRef: string): Promise<void> {
    await prisma.$transaction(async (tx) => {
      const deleted = await tx.shelfItem.deleteMany({
        where: { shelfUnitId, itemRef },
      });
      if (deleted.count > 0) {
        await tx.shelf.update({
          where: { unitId: shelfUnitId },
          data: { itemCount: { decrement: deleted.count } },
        });
      }
    });
    await syncContainedUnitIdsToMeili(shelfUnitId);
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

    const projection = await buildShelfItemProjection(shelfUnitId, [itemRef]);
    return mapShelfItemToDTO(item, projection.get(itemRef));
  }

  private async rebalanceWindow(
    shelfUnitId: string,
    movedItemRef: string,
    beforeItemRef: string | undefined,
    afterItemRef: string | undefined,
  ): Promise<ShelfItemDTO> {
    const rows = await prisma.shelfItem.findMany({
      where: { shelfUnitId },
      orderBy: { position: "asc" },
      take: REBALANCE_WINDOW,
      select: { itemRef: true },
    });

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
    const projection = await buildShelfItemProjection(shelfUnitId, [
      movedItemRef,
    ]);
    return mapShelfItemToDTO(moved, projection.get(movedItemRef));
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

    const projection = await buildShelfItemProjection(
      shelfUnitId,
      page.map((p) => p.itemRef),
    );

    return {
      items: page.map((p) => mapShelfItemToDTO(p, projection.get(p.itemRef))),
      hasMore,
    };
  }

  // --- ShelfUnit role attachments ---

  async attachReview(
    shelfUnitId: string,
    itemRef: string,
    reviewUnitId: string,
    fallbackKind?: ShelfItemKind,
  ): Promise<ShelfItemDTO> {
    let didCreateSlot = false;
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.shelfItem.findUnique({
        where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
      });
      if (!existing) didCreateSlot = true;

      if (!existing) {
        const kind = fallbackKind ?? (await this.deriveKind(itemRef));
        const last = await tx.shelfItem.findFirst({
          where: { shelfUnitId },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        const position = generateBetween(last?.position, undefined);
        const created = await tx.shelfItem.createMany({
          data: [{ shelfUnitId, itemRef, kind, position }],
          skipDuplicates: true,
        });
        if (created.count > 0) {
          await tx.shelf.update({
            where: { unitId: shelfUnitId },
            data: { itemCount: { increment: 1 } },
          });
        }
        await tx.shelfUnit.upsert({
          where: {
            shelfUnitId_itemRef_unitId_role: {
              shelfUnitId,
              itemRef,
              unitId: itemRef,
              role: "primary",
            },
          },
          create: { shelfUnitId, itemRef, unitId: itemRef, role: "primary" },
          update: {},
        });
      }

      await tx.shelfUnit.upsert({
        where: {
          shelfUnitId_itemRef_unitId_role: {
            shelfUnitId,
            itemRef,
            unitId: reviewUnitId,
            role: "review",
          },
        },
        create: {
          shelfUnitId,
          itemRef,
          unitId: reviewUnitId,
          role: "review",
        },
        update: {},
      });

      return tx.shelfItem.findUniqueOrThrow({
        where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
      });
    });

    const projection = await buildShelfItemProjection(shelfUnitId, [itemRef]);
    if (didCreateSlot) {
      await syncContainedUnitIdsToMeili(shelfUnitId);
    }
    return mapShelfItemToDTO(item, projection.get(itemRef));
  }

  async detachReview(
    shelfUnitId: string,
    itemRef: string,
    reviewUnitId: string,
  ): Promise<ShelfItemDTO> {
    await prisma.shelfUnit.deleteMany({
      where: { shelfUnitId, itemRef, unitId: reviewUnitId, role: "review" },
    });

    const item = await prisma.shelfItem.findUniqueOrThrow({
      where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
    });
    const projection = await buildShelfItemProjection(shelfUnitId, [itemRef]);
    return mapShelfItemToDTO(item, projection.get(itemRef));
  }

  async setItemTags(
    shelfUnitId: string,
    itemRef: string,
    tagIds: string[],
  ): Promise<ShelfItemDTO> {
    const item = await prisma.$transaction(async (tx) => {
      const existing = await tx.shelfUnit.findMany({
        where: { shelfUnitId, itemRef, role: "tag" },
        select: { unitId: true },
      });
      const existingSet = new Set(existing.map((e) => e.unitId));
      const nextSet = new Set(tagIds);

      const toAdd = [...nextSet].filter((id) => !existingSet.has(id));
      const toRemove = [...existingSet].filter((id) => !nextSet.has(id));

      if (toRemove.length > 0) {
        await tx.shelfUnit.deleteMany({
          where: {
            shelfUnitId,
            itemRef,
            role: "tag",
            unitId: { in: toRemove },
          },
        });
      }
      for (const unitId of toAdd) {
        await tx.shelfUnit.create({
          data: { shelfUnitId, itemRef, unitId, role: "tag" },
        });
      }

      return tx.shelfItem.findUniqueOrThrow({
        where: { shelfUnitId_itemRef: { shelfUnitId, itemRef } },
      });
    });

    const projection = await buildShelfItemProjection(shelfUnitId, [itemRef]);
    return mapShelfItemToDTO(item, projection.get(itemRef));
  }

  async applyBatch(
    shelfUnitId: string,
    ops: ShelfItemBatchOp[],
  ): Promise<ShelfItemBatchResult[]> {
    if (ops.length > SHELF_ITEM_BATCH_OP_CAP) {
      throw new AppError(
        413,
        `Batch exceeds maximum of ${SHELF_ITEM_BATCH_OP_CAP} ops per request`,
      );
    }

    const results: ShelfItemBatchResult[] = [];
    const touchedRefs = new Set<string>();
    let mutated = false;

    await prisma.$transaction(async (tx) => {
      for (const op of ops) {
        try {
          switch (op.op) {
            case "add": {
              if (shelfUnitId === op.itemRef) {
                results.push({
                  status: "failed",
                  op,
                  reason: "A shelf cannot contain itself",
                });
                continue;
              }
              const created = await tx.shelfItem.createMany({
                data: [
                  {
                    shelfUnitId,
                    itemRef: op.itemRef,
                    kind: op.kind,
                    position: op.position,
                  },
                ],
                skipDuplicates: true,
              });
              if (created.count > 0) {
                await tx.shelf.update({
                  where: { unitId: shelfUnitId },
                  data: { itemCount: { increment: 1 } },
                });
                mutated = true;
              }
              await tx.shelfUnit.upsert({
                where: {
                  shelfUnitId_itemRef_unitId_role: {
                    shelfUnitId,
                    itemRef: op.itemRef,
                    unitId: op.itemRef,
                    role: "primary",
                  },
                },
                create: {
                  shelfUnitId,
                  itemRef: op.itemRef,
                  unitId: op.itemRef,
                  role: "primary",
                },
                update: {},
              });
              for (const reviewId of op.reviewIds ?? []) {
                await tx.shelfUnit.upsert({
                  where: {
                    shelfUnitId_itemRef_unitId_role: {
                      shelfUnitId,
                      itemRef: op.itemRef,
                      unitId: reviewId,
                      role: "review",
                    },
                  },
                  create: {
                    shelfUnitId,
                    itemRef: op.itemRef,
                    unitId: reviewId,
                    role: "review",
                  },
                  update: {},
                });
              }
              for (const tagId of op.tagIds ?? []) {
                await tx.shelfUnit.upsert({
                  where: {
                    shelfUnitId_itemRef_unitId_role: {
                      shelfUnitId,
                      itemRef: op.itemRef,
                      unitId: tagId,
                      role: "tag",
                    },
                  },
                  create: {
                    shelfUnitId,
                    itemRef: op.itemRef,
                    unitId: tagId,
                    role: "tag",
                  },
                  update: {},
                });
              }
              const slot = await tx.shelfItem.findUniqueOrThrow({
                where: {
                  shelfUnitId_itemRef: { shelfUnitId, itemRef: op.itemRef },
                },
              });
              touchedRefs.add(op.itemRef);
              results.push({
                status: "ok",
                op,
                item: mapShelfItemToDTO(slot, undefined),
              });
              break;
            }
            case "reorder": {
              const updated = await tx.shelfItem.update({
                where: {
                  shelfUnitId_itemRef: { shelfUnitId, itemRef: op.itemRef },
                },
                data: { position: op.position },
              });
              touchedRefs.add(op.itemRef);
              results.push({
                status: "ok",
                op,
                item: mapShelfItemToDTO(updated, undefined),
              });
              break;
            }
            case "reorderToPage": {
              const skip = (op.toPage - 1) * CROSS_PAGE_PAGE_SIZE;
              if (skip < 0) {
                results.push({
                  status: "failed",
                  op,
                  reason: `Invalid page ${op.toPage}`,
                });
                continue;
              }
              const first = await tx.shelfItem.findFirst({
                where: { shelfUnitId },
                orderBy: { position: "asc" },
                skip,
                select: { position: true },
              });
              if (!first) {
                results.push({
                  status: "failed",
                  op,
                  reason: `Page ${op.toPage} is out of range`,
                });
                continue;
              }
              const newPosition = generateBetween(undefined, first.position);
              const updated = await tx.shelfItem.update({
                where: {
                  shelfUnitId_itemRef: { shelfUnitId, itemRef: op.itemRef },
                },
                data: { position: newPosition },
              });
              touchedRefs.add(op.itemRef);
              results.push({
                status: "ok",
                op,
                item: mapShelfItemToDTO(updated, undefined),
              });
              break;
            }
            case "delete": {
              const deleted = await tx.shelfItem.deleteMany({
                where: { shelfUnitId, itemRef: op.itemRef },
              });
              if (deleted.count > 0) {
                await tx.shelf.update({
                  where: { unitId: shelfUnitId },
                  data: { itemCount: { decrement: deleted.count } },
                });
                mutated = true;
              }
              results.push({ status: "ok", op });
              break;
            }
            case "setTags": {
              const existing = await tx.shelfUnit.findMany({
                where: { shelfUnitId, itemRef: op.itemRef, role: "tag" },
                select: { unitId: true },
              });
              const existingSet = new Set(existing.map((e) => e.unitId));
              const nextSet = new Set(op.tagIds);
              const toAdd = [...nextSet].filter((id) => !existingSet.has(id));
              const toRemove = [...existingSet].filter(
                (id) => !nextSet.has(id),
              );
              if (toRemove.length > 0) {
                await tx.shelfUnit.deleteMany({
                  where: {
                    shelfUnitId,
                    itemRef: op.itemRef,
                    role: "tag",
                    unitId: { in: toRemove },
                  },
                });
              }
              for (const unitId of toAdd) {
                await tx.shelfUnit.create({
                  data: {
                    shelfUnitId,
                    itemRef: op.itemRef,
                    unitId,
                    role: "tag",
                  },
                });
              }
              const slot = await tx.shelfItem.findUniqueOrThrow({
                where: {
                  shelfUnitId_itemRef: { shelfUnitId, itemRef: op.itemRef },
                },
              });
              touchedRefs.add(op.itemRef);
              results.push({
                status: "ok",
                op,
                item: mapShelfItemToDTO(slot, undefined),
              });
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

    if (touchedRefs.size > 0) {
      const refs = [...touchedRefs];
      const projection = await buildShelfItemProjection(shelfUnitId, refs);
      for (let i = 0; i < results.length; i += 1) {
        const r = results[i]!;
        if (r.status === "ok" && r.item && touchedRefs.has(r.op.itemRef)) {
          const fresh = await prisma.shelfItem.findUnique({
            where: {
              shelfUnitId_itemRef: { shelfUnitId, itemRef: r.op.itemRef },
            },
          });
          if (fresh) {
            results[i] = {
              status: "ok",
              op: r.op,
              item: mapShelfItemToDTO(fresh, projection.get(r.op.itemRef)),
            };
          }
        }
      }
    }

    if (mutated) {
      await syncContainedUnitIdsToMeili(shelfUnitId);
    }

    return results;
  }

  async cleanupOrphans(
    shelfUnitId: string,
    orphanItemRefs: string[],
  ): Promise<{ deleted: number }> {
    if (orphanItemRefs.length === 0) return { deleted: 0 };
    const result = await prisma.$transaction(async (tx) => {
      const deleted = await tx.shelfItem.deleteMany({
        where: { shelfUnitId, itemRef: { in: orphanItemRefs } },
      });
      if (deleted.count > 0) {
        await tx.shelf.update({
          where: { unitId: shelfUnitId },
          data: { itemCount: { decrement: deleted.count } },
        });
      }
      return deleted;
    });
    if (result.count > 0) {
      await syncContainedUnitIdsToMeili(shelfUnitId);
    }
    return { deleted: result.count };
  }
}

export function mapUnitToKind(
  type: UnitType,
  postKind: PostKind | null,
): ShelfItemKind {
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
      return type.toString().toLowerCase() as ShelfItemKind;
  }
}

export const shelfService = new ShelfService();
