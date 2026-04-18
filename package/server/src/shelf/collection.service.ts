import type {
  CollectInput,
  CollectionStatusResponse,
  CollectResponse,
  ShelfItemKind,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import {
  PostKind,
  prisma,
  UnitStatus,
  UnitType,
  UnitVisibility,
} from "#/prisma/client";
import { generateBetween } from "./fractional-index";
import { mapUnitToKind } from "./shelf.service";

const FAVORITES_KIND_KEY = "favorites";

interface ResolvedTarget {
  /** Unit id of the shelf slot (the target work, or the target itself). */
  itemRef: string;
  /** Kind discriminator for the slot. */
  kind: ShelfItemKind;
  /** If the original targetId is a review post, its unit id; else undefined. */
  reviewUnitId?: string;
}

export class CollectionService {
  /**
   * Get or create the user's Favorites shelf.
   */
  private async getFavoritesShelfId(userId: string): Promise<string> {
    const existing = await prisma.shelf.findFirst({
      where: {
        kindKey: FAVORITES_KIND_KEY,
        unit: { userId, type: UnitType.SHELF },
      },
      select: { unitId: true },
    });

    if (existing) return existing.unitId;

    const unit = await prisma.unit.create({
      data: {
        userId,
        type: UnitType.SHELF,
        status: UnitStatus.PUBLISHED,
        visibility: UnitVisibility.PRIVATE,
        translations: {
          create: { language: "en", title: "Favorites" },
        },
      },
    });

    await prisma.shelf.create({
      data: { unitId: unit.id, kindKey: FAVORITES_KIND_KEY },
    });

    return unit.id;
  }

  /**
   * Resolve the collect target to a slot itemRef + kind.
   *
   * - If `targetId` is a REVIEW post with a `targetUnitId`, the slot is the
   *   target work (the book the review is about) and the review's own unit id
   *   is threaded back so it can be appended to `ShelfItem.reviewIds`.
   * - Otherwise the target is used directly.
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
      // Slot the review against its target work; record review for reviewIds append.
      const target = await prisma.unit.findUniqueOrThrow({
        where: { id: unit.post.targetUnitId },
        select: { type: true, post: { select: { kind: true } } },
      });
      return {
        itemRef: unit.post.targetUnitId,
        kind: mapUnitToKind(target.type, target.post?.kind ?? null),
        reviewUnitId: targetId,
      };
    }

    return {
      itemRef: targetId,
      kind: mapUnitToKind(unit.type, unit.post?.kind ?? null),
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
        const shelf = await tx.shelf.findFirst({
          where: { unitId: shelfId, unit: { userId } },
        });
        if (!shelf) continue;

        const existing = await tx.shelfItem.findUnique({
          where: {
            shelfUnitId_itemRef: {
              shelfUnitId: shelfId,
              itemRef: resolved.itemRef,
            },
          },
        });

        if (existing) {
          if (
            resolved.reviewUnitId &&
            !existing.reviewIds.includes(resolved.reviewUnitId)
          ) {
            await tx.shelfItem.update({
              where: {
                shelfUnitId_itemRef: {
                  shelfUnitId: shelfId,
                  itemRef: resolved.itemRef,
                },
              },
              data: {
                reviewIds: {
                  set: [...existing.reviewIds, resolved.reviewUnitId],
                },
              },
            });
          }
        } else {
          const last = await tx.shelfItem.findFirst({
            where: { shelfUnitId: shelfId },
            orderBy: { position: "desc" },
            select: { position: true },
          });
          const position = generateBetween(last?.position, undefined);
          await tx.shelfItem.create({
            data: {
              shelfUnitId: shelfId,
              itemRef: resolved.itemRef,
              kind: resolved.kind,
              position,
              reviewIds: resolved.reviewUnitId ? [resolved.reviewUnitId] : [],
              tagIds: [],
            },
          });
          isNew = true;
        }

        savedTo.push(shelfId);
      }
    });

    return { savedTo, isNew };
  }

  /**
   * Toggle a unit in/out of the user's Favorites shelf.
   */
  async toggleFavorite(
    userId: string,
    targetId: string,
  ): Promise<ToggleFavoriteResponse> {
    const favShelfId = await this.getFavoritesShelfId(userId);
    const resolved = await this.resolveTarget(targetId, false);

    const existing = await prisma.shelfItem.findUnique({
      where: {
        shelfUnitId_itemRef: {
          shelfUnitId: favShelfId,
          itemRef: resolved.itemRef,
        },
      },
    });

    if (existing) {
      await prisma.shelfItem.delete({
        where: {
          shelfUnitId_itemRef: {
            shelfUnitId: favShelfId,
            itemRef: resolved.itemRef,
          },
        },
      });
      return { isFavorited: false };
    }

    const last = await prisma.shelfItem.findFirst({
      where: { shelfUnitId: favShelfId },
      orderBy: { position: "desc" },
      select: { position: true },
    });
    const position = generateBetween(last?.position, undefined);

    await prisma.shelfItem.create({
      data: {
        shelfUnitId: favShelfId,
        itemRef: resolved.itemRef,
        kind: resolved.kind,
        position,
        reviewIds: resolved.reviewUnitId ? [resolved.reviewUnitId] : [],
        tagIds: [],
      },
    });

    return { isFavorited: true };
  }

  /**
   * Check which shelves contain a given unit.
   */
  async getCollectionStatus(
    userId: string,
    targetId: string,
  ): Promise<CollectionStatusResponse> {
    const resolved = await this.resolveTarget(targetId, false);
    const itemRef = resolved.itemRef;
    const favShelfId = await this.getFavoritesShelfId(userId);

    const shelfItems = await prisma.shelfItem.findMany({
      where: {
        itemRef,
        shelf: { unit: { userId } },
      },
      select: {
        shelfUnitId: true,
        reviewIds: true,
        shelf: {
          select: {
            unit: {
              select: {
                translations: {
                  where: { language: "en" },
                  select: { title: true },
                },
              },
            },
          },
        },
      },
    });

    // If original target is a review, the status should reflect whether the
    // review specifically is attached.
    const reviewGate = resolved.reviewUnitId;
    const filtered = reviewGate
      ? shelfItems.filter((si) => si.reviewIds.includes(reviewGate))
      : shelfItems;

    const isFavorited = filtered.some((si) => si.shelfUnitId === favShelfId);
    const shelves = filtered.map((si) => ({
      id: si.shelfUnitId,
      title: si.shelf?.unit?.translations?.[0]?.title ?? null,
    }));

    return { isFavorited, shelves };
  }
}

export const collectionService = new CollectionService();
