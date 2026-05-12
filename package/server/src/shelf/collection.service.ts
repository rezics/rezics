import type {
  CollectInput,
  CollectionStatusResponse,
  CollectResponse,
  ShelfUnitKind,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import { PostKind, prisma, UnitType } from "#/prisma/client";
import { AppError } from "@/utils/errors";
import { generateBetween } from "./fractional-index";
import { mapUnitToKind } from "./shelf.service";
import { getOrCreateSystemShelf } from "./system-shelves";

const FAVORITES_KIND_KEY = "favorites";

interface ResolvedTarget {
  /** Unit id of the parent shelf unit (the target work, or the target itself). */
  parentUnitId: string;
  /** Kind discriminator for the parent shelf unit. */
  parentKind: ShelfUnitKind;
  /** If the original targetId is a review post, its unit id and kind; else undefined. */
  reviewUnitId?: string;
  reviewKind?: ShelfUnitKind;
}

export class CollectionService {
  private async getFavoritesShelfId(userId: string): Promise<string> {
    return getOrCreateSystemShelf(userId, FAVORITES_KIND_KEY);
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
    const { targetId, shelfIds, independent = false } = input;
    const resolved = await this.resolveTarget(targetId, independent);

    const savedTo: string[] = [];
    let isNew = false;

    await prisma.$transaction(async (tx) => {
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
}

export const collectionService = new CollectionService();
