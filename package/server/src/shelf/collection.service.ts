import type {
  CollectInput,
  CollectionStatusBatchResponse,
  CollectionStatusResponse,
  CollectResponse,
  ShelfUnitKind,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import { PostKind, prisma, UnitType } from "#/prisma/client";
import { AppError } from "@/utils/errors";
import { generateBetween } from "./fractional-index";
import { mapUnitToKind, reconcileShelfWorkMemberships } from "./shelf.service";
import { findSystemShelf } from "./system-shelves";
import {
  applyUserUnitCollectionMetadata,
  enqueueUserUnitCollectionSearchSync,
} from "./user-unit-collection.service";

const FAVORITES_KIND_KEY = "favorites" as const;
const COLLECTION_STATUS_BATCH_CAP = 100;

interface ResolvedTarget {
  /** Unit id of the parent shelf unit (the target work, or the target itself). */
  parentUnitId: string;
  /** Kind discriminator for the parent shelf unit. */
  parentKind: ShelfUnitKind;
  /** If the original targetId is a review post, its unit id and kind; else undefined. */
  reviewUnitId?: string;
  reviewKind?: ShelfUnitKind;
}

interface BatchResolvedTarget {
  targetId: string;
  parentUnitId: string;
  reviewUnitId?: string;
}

export class CollectionService {
  private async getFavoritesShelfId(userId: string): Promise<string> {
    const shelfId = await findSystemShelf(userId, FAVORITES_KIND_KEY, prisma);
    if (!shelfId) {
      throw new AppError(404, "Favorites shelf not found", {
        code: "system_shelf_missing",
        details: { kindKey: FAVORITES_KIND_KEY },
      });
    }
    return shelfId;
  }

  /**
   * Resolve the collect target to a parent shelf unit + optional review child.
   *
   * - If `targetId` is a REVIEW post with a `targetUnitId`, the parent is the
   *   target work and the review itself is threaded back as a child of role='review'.
   * - Otherwise the target is the parent.
   */
  private async resolveTarget(
    targetId: string,
    independent: boolean,
  ): Promise<ResolvedTarget> {
    const unit = await prisma.unit.findUniqueOrThrow({
      where: { id: targetId },
      select: {
        type: true,
        post: { select: { kind: true, targetUnitId: true } },
      },
    });

    if (
      !independent &&
      unit.type === UnitType.POST &&
      unit.post?.kind === PostKind.REVIEW &&
      unit.post?.targetUnitId
    ) {
      const target = await prisma.unit.findUniqueOrThrow({
        where: { id: unit.post.targetUnitId },
        select: { type: true, post: { select: { kind: true } } },
      });
      return {
        parentUnitId: unit.post.targetUnitId,
        parentKind: mapUnitToKind(target.type, target.post?.kind ?? null),
        reviewUnitId: targetId,
        reviewKind: "review",
      };
    }

    return {
      parentUnitId: targetId,
      parentKind: mapUnitToKind(unit.type, unit.post?.kind ?? null),
    };
  }

  /**
   * Collect a unit to multiple shelves.
   */
  async collect(userId: string, input: CollectInput): Promise<CollectResponse> {
    const {
      targetId,
      shelfIds,
      independent = false,
      tagUnitIds,
      searchText,
    } = input;
    const resolved = await this.resolveTarget(targetId, independent);

    const savedTo: string[] = [];
    let isNew = false;

    await prisma.$transaction(async (tx) => {
      await applyUserUnitCollectionMetadata(tx, userId, resolved.parentUnitId, {
        tagUnitIds,
        searchText,
      });

      for (const shelfId of shelfIds) {
        if (shelfId === resolved.parentUnitId) {
          throw new AppError(400, "A shelf cannot contain itself");
        }

        const shelf = await tx.shelf.findFirst({
          where: { unitId: shelfId, unit: { userId } },
        });
        if (!shelf) continue;

        const existingParent = await tx.shelfUnit.findUnique({
          where: {
            shelfId_unitId: { shelfId, unitId: resolved.parentUnitId },
          },
        });

        if (!existingParent) {
          const last = await tx.shelfUnit.findFirst({
            where: { shelfId },
            orderBy: { position: "desc" },
            select: { position: true },
          });
          const position = generateBetween(last?.position, undefined);
          const created = await tx.shelfUnit.createMany({
            data: [
              {
                shelfId,
                unitId: resolved.parentUnitId,
                kind: resolved.parentKind,
                position,
              },
            ],
            skipDuplicates: true,
          });
          if (created.count > 0) {
            await tx.shelf.update({
              where: { unitId: shelfId },
              data: { itemCount: { increment: 1 } },
            });
            isNew = true;
          }
        }

        if (resolved.reviewUnitId && resolved.reviewKind) {
          const existingReview = await tx.shelfUnit.findUnique({
            where: {
              shelfId_unitId: { shelfId, unitId: resolved.reviewUnitId },
            },
          });
          if (!existingReview) {
            const last = await tx.shelfUnit.findFirst({
              where: { shelfId },
              orderBy: { position: "desc" },
              select: { position: true },
            });
            const position = generateBetween(last?.position, undefined);
            const created = await tx.shelfUnit.createMany({
              data: [
                {
                  shelfId,
                  unitId: resolved.reviewUnitId,
                  kind: resolved.reviewKind,
                  position,
                },
              ],
              skipDuplicates: true,
            });
            if (created.count > 0) {
              await tx.shelf.update({
                where: { unitId: shelfId },
                data: { itemCount: { increment: 1 } },
              });
            }
          }
          await tx.shelfUnitRelation.upsert({
            where: {
              shelfId_parentUnitId_childUnitId_role: {
                shelfId,
                parentUnitId: resolved.parentUnitId,
                childUnitId: resolved.reviewUnitId,
                role: "review",
              },
            },
            create: {
              shelfId,
              parentUnitId: resolved.parentUnitId,
              childUnitId: resolved.reviewUnitId,
              role: "review",
            },
            update: {},
          });
        }

        savedTo.push(shelfId);
      }
    });

    if (searchText !== undefined) {
      await enqueueUserUnitCollectionSearchSync(userId, resolved.parentUnitId);
    }

    await Promise.all(
      savedTo.map((shelfId) => reconcileShelfWorkMemberships(shelfId)),
    );

    return { savedTo, isNew };
  }

  async toggleFavorite(
    userId: string,
    targetId: string,
  ): Promise<ToggleFavoriteResponse> {
    const favShelfId = await this.getFavoritesShelfId(userId);
    const resolved = await this.resolveTarget(targetId, false);

    if (favShelfId === resolved.parentUnitId) {
      throw new AppError(400, "A shelf cannot contain itself");
    }

    const existing = await prisma.shelfUnit.findUnique({
      where: {
        shelfId_unitId: { shelfId: favShelfId, unitId: resolved.parentUnitId },
      },
    });

    if (existing) {
      await prisma.$transaction(async (tx) => {
        const deleted = await tx.shelfUnit.deleteMany({
          where: { shelfId: favShelfId, unitId: resolved.parentUnitId },
        });
        if (deleted.count > 0) {
          await tx.shelf.update({
            where: { unitId: favShelfId },
            data: { itemCount: { decrement: deleted.count } },
          });
        }
        if (resolved.reviewUnitId) {
          const reviewDeleted = await tx.shelfUnit.deleteMany({
            where: { shelfId: favShelfId, unitId: resolved.reviewUnitId },
          });
          if (reviewDeleted.count > 0) {
            await tx.shelf.update({
              where: { unitId: favShelfId },
              data: { itemCount: { decrement: reviewDeleted.count } },
            });
          }
        }
      });
      await reconcileShelfWorkMemberships(favShelfId);
      return { isFavorited: false };
    }

    await prisma.$transaction(async (tx) => {
      const last = await tx.shelfUnit.findFirst({
        where: { shelfId: favShelfId },
        orderBy: { position: "desc" },
        select: { position: true },
      });
      const parentPosition = generateBetween(last?.position, undefined);
      const parentCreated = await tx.shelfUnit.createMany({
        data: [
          {
            shelfId: favShelfId,
            unitId: resolved.parentUnitId,
            kind: resolved.parentKind,
            position: parentPosition,
          },
        ],
        skipDuplicates: true,
      });
      if (parentCreated.count > 0) {
        await tx.shelf.update({
          where: { unitId: favShelfId },
          data: { itemCount: { increment: 1 } },
        });
      }
      if (resolved.reviewUnitId && resolved.reviewKind) {
        const lastNow = await tx.shelfUnit.findFirst({
          where: { shelfId: favShelfId },
          orderBy: { position: "desc" },
          select: { position: true },
        });
        const reviewPosition = generateBetween(lastNow?.position, undefined);
        const reviewCreated = await tx.shelfUnit.createMany({
          data: [
            {
              shelfId: favShelfId,
              unitId: resolved.reviewUnitId,
              kind: resolved.reviewKind,
              position: reviewPosition,
            },
          ],
          skipDuplicates: true,
        });
        if (reviewCreated.count > 0) {
          await tx.shelf.update({
            where: { unitId: favShelfId },
            data: { itemCount: { increment: 1 } },
          });
        }
        await tx.shelfUnitRelation.upsert({
          where: {
            shelfId_parentUnitId_childUnitId_role: {
              shelfId: favShelfId,
              parentUnitId: resolved.parentUnitId,
              childUnitId: resolved.reviewUnitId,
              role: "review",
            },
          },
          create: {
            shelfId: favShelfId,
            parentUnitId: resolved.parentUnitId,
            childUnitId: resolved.reviewUnitId,
            role: "review",
          },
          update: {},
        });
      }
    });

    await reconcileShelfWorkMemberships(favShelfId);
    return { isFavorited: true };
  }

  async getCollectionStatus(
    userId: string,
    targetId: string,
  ): Promise<CollectionStatusResponse> {
    const resolved = await this.resolveTarget(targetId, false);
    const favShelfId = await this.getFavoritesShelfId(userId);

    // If original target is a review, status reflects whether the review
    // is attached as a child of role='review'. Otherwise, status reflects
    // direct ShelfUnit containment.
    let shelfIds: string[];
    if (resolved.reviewUnitId) {
      const rows = await prisma.shelfUnitRelation.findMany({
        where: {
          childUnitId: resolved.reviewUnitId,
          role: "review",
          shelf: { unit: { userId } },
        },
        select: { shelfId: true },
      });
      shelfIds = rows.map((r) => r.shelfId);
    } else {
      const rows = await prisma.shelfUnit.findMany({
        where: {
          unitId: resolved.parentUnitId,
          shelf: { unit: { userId } },
        },
        select: { shelfId: true },
      });
      shelfIds = rows.map((r) => r.shelfId);
    }

    if (shelfIds.length === 0) {
      return { isFavorited: false, shelves: [] };
    }

    const shelfRows = await prisma.shelf.findMany({
      where: { unitId: { in: shelfIds } },
      select: {
        unitId: true,
        unit: {
          select: {
            translations: {
              where: { language: "en" },
              select: { title: true },
            },
          },
        },
      },
    });

    const isFavorited = shelfIds.includes(favShelfId);
    const shelves = shelfRows.map((s) => ({
      id: s.unitId,
      title: s.unit?.translations?.[0]?.title ?? null,
    }));

    return { isFavorited, shelves };
  }

  async getCollectionStatusBatch(
    userId: string,
    targetIds: string[],
  ): Promise<CollectionStatusBatchResponse> {
    const normalizedTargetIds = Array.from(
      new Set(targetIds.map((id) => id.trim()).filter(Boolean)),
    );

    if (normalizedTargetIds.length > COLLECTION_STATUS_BATCH_CAP) {
      throw new AppError(
        400,
        `Collection status batch is limited to ${COLLECTION_STATUS_BATCH_CAP} targets`,
      );
    }

    const statusesByTarget: CollectionStatusBatchResponse["statusesByTarget"] =
      Object.fromEntries(
        normalizedTargetIds.map((targetId) => [
          targetId,
          { isFavorited: false, shelves: [] },
        ]),
      );

    if (normalizedTargetIds.length === 0) {
      return { statusesByTarget };
    }

    const units = await prisma.unit.findMany({
      where: { id: { in: normalizedTargetIds } },
      select: {
        id: true,
        type: true,
        post: { select: { kind: true, targetUnitId: true } },
      },
    });

    const reviewTargetIds = new Set<string>();
    for (const unit of units) {
      if (
        unit.type === UnitType.POST &&
        unit.post?.kind === PostKind.REVIEW &&
        unit.post.targetUnitId
      ) {
        reviewTargetIds.add(unit.post.targetUnitId);
      }
    }

    const reviewTargets =
      reviewTargetIds.size > 0
        ? await prisma.unit.findMany({
            where: { id: { in: [...reviewTargetIds] } },
            select: {
              id: true,
              type: true,
              post: { select: { kind: true } },
            },
          })
        : [];
    const reviewTargetById = new Map(reviewTargets.map((u) => [u.id, u]));

    const resolvedTargets: BatchResolvedTarget[] = units.map((unit) => {
      if (
        unit.type === UnitType.POST &&
        unit.post?.kind === PostKind.REVIEW &&
        unit.post.targetUnitId
      ) {
        const target = reviewTargetById.get(unit.post.targetUnitId);
        if (target) {
          return {
            targetId: unit.id,
            parentUnitId: target.id,
            reviewUnitId: unit.id,
          };
        }
      }

      return {
        targetId: unit.id,
        parentUnitId: unit.id,
      };
    });

    const favShelfId = await this.getFavoritesShelfId(userId);
    const parentUnitIds = [
      ...new Set(
        resolvedTargets
          .filter((target) => !target.reviewUnitId)
          .map((target) => target.parentUnitId),
      ),
    ];
    const reviewUnitIds = [
      ...new Set(
        resolvedTargets
          .map((target) => target.reviewUnitId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [directRows, reviewRows] = await Promise.all([
      parentUnitIds.length > 0
        ? prisma.shelfUnit.findMany({
            where: {
              unitId: { in: parentUnitIds },
              shelf: { unit: { userId } },
            },
            select: { unitId: true, shelfId: true },
          })
        : [],
      reviewUnitIds.length > 0
        ? prisma.shelfUnitRelation.findMany({
            where: {
              childUnitId: { in: reviewUnitIds },
              role: "review",
              shelf: { unit: { userId } },
            },
            select: { childUnitId: true, shelfId: true },
          })
        : [],
    ]);

    const directShelfIdsByUnitId = new Map<string, string[]>();
    for (const row of directRows) {
      const ids = directShelfIdsByUnitId.get(row.unitId) ?? [];
      ids.push(row.shelfId);
      directShelfIdsByUnitId.set(row.unitId, ids);
    }

    const reviewShelfIdsByUnitId = new Map<string, string[]>();
    for (const row of reviewRows) {
      const ids = reviewShelfIdsByUnitId.get(row.childUnitId) ?? [];
      ids.push(row.shelfId);
      reviewShelfIdsByUnitId.set(row.childUnitId, ids);
    }

    const allShelfIds = new Set<string>();
    for (const target of resolvedTargets) {
      const shelfIds = target.reviewUnitId
        ? (reviewShelfIdsByUnitId.get(target.reviewUnitId) ?? [])
        : (directShelfIdsByUnitId.get(target.parentUnitId) ?? []);
      for (const shelfId of shelfIds) allShelfIds.add(shelfId);
    }

    const shelfRows =
      allShelfIds.size > 0
        ? await prisma.shelf.findMany({
            where: { unitId: { in: [...allShelfIds] } },
            select: {
              unitId: true,
              unit: {
                select: {
                  translations: {
                    where: { language: "en" },
                    select: { title: true },
                  },
                },
              },
            },
          })
        : [];
    const shelfTitleById = new Map(
      shelfRows.map((s) => [
        s.unitId,
        s.unit?.translations?.[0]?.title ?? null,
      ]),
    );

    for (const target of resolvedTargets) {
      const shelfIds = target.reviewUnitId
        ? (reviewShelfIdsByUnitId.get(target.reviewUnitId) ?? [])
        : (directShelfIdsByUnitId.get(target.parentUnitId) ?? []);
      statusesByTarget[target.targetId] = {
        isFavorited: shelfIds.includes(favShelfId),
        shelves: shelfIds.map((shelfId) => ({
          id: shelfId,
          title: shelfTitleById.get(shelfId) ?? null,
        })),
      };
    }

    return { statusesByTarget };
  }
}

export const collectionService = new CollectionService();
