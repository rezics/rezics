import type {
  CollectInput,
  CollectionStatusResponse,
  CollectResponse,
  ShelfItemKind,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import { PostKind, prisma, UnitType } from "#/prisma/client";
import { generateBetween } from "./fractional-index";
import { mapUnitToKind } from "./shelf.service";
import { getOrCreateSystemShelf } from "./system-shelves";

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
    return getOrCreateSystemShelf(userId, FAVORITES_KIND_KEY);
  }

  /**
   * Resolve the collect target to a slot itemRef + kind.
   *
   * - If `targetId` is a REVIEW post with a `targetUnitId`, the slot is the
   *   target work (the book the review is about) and the review's own unit id
   *   is threaded back so it can be written as a role='review' ShelfUnit row.
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

        if (!existing) {
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
            },
          });
          await tx.shelfUnit.create({
            data: {
              shelfUnitId: shelfId,
              itemRef: resolved.itemRef,
              unitId: resolved.itemRef,
              role: "primary",
            },
          });
          isNew = true;
        }

        if (resolved.reviewUnitId) {
          await tx.shelfUnit.upsert({
            where: {
              shelfUnitId_itemRef_unitId_role: {
                shelfUnitId: shelfId,
                itemRef: resolved.itemRef,
                unitId: resolved.reviewUnitId,
                role: "review",
              },
            },
            create: {
              shelfUnitId: shelfId,
              itemRef: resolved.itemRef,
              unitId: resolved.reviewUnitId,
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

    await prisma.$transaction(async (tx) => {
      await tx.shelfItem.create({
        data: {
          shelfUnitId: favShelfId,
          itemRef: resolved.itemRef,
          kind: resolved.kind,
          position,
        },
      });
      await tx.shelfUnit.create({
        data: {
          shelfUnitId: favShelfId,
          itemRef: resolved.itemRef,
          unitId: resolved.itemRef,
          role: "primary",
        },
      });
      if (resolved.reviewUnitId) {
        await tx.shelfUnit.create({
          data: {
            shelfUnitId: favShelfId,
            itemRef: resolved.itemRef,
            unitId: resolved.reviewUnitId,
            role: "review",
          },
        });
      }
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
    const favShelfId = await this.getFavoritesShelfId(userId);

    // If original target is a review, status reflects whether the review
    // specifically is attached. Otherwise, status reflects primary slot presence.
    const lookupUnitId = resolved.reviewUnitId ?? resolved.itemRef;
    const lookupRole = resolved.reviewUnitId ? "review" : "primary";

    const rows = await prisma.shelfUnit.findMany({
      where: {
        unitId: lookupUnitId,
        role: lookupRole,
        shelf: { unit: { userId } },
      },
      select: {
        shelfUnitId: true,
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

    const isFavorited = rows.some((r) => r.shelfUnitId === favShelfId);
    const shelves = rows.map((r) => ({
      id: r.shelfUnitId,
      title: r.shelf?.unit?.translations?.[0]?.title ?? null,
    }));

    return { isFavorited, shelves };
  }
}

export const collectionService = new CollectionService();
