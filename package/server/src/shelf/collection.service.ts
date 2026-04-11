import type {
  CollectInput,
  CollectResponse,
  CollectionStatusResponse,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import { prisma, PostKind, UnitStatus, UnitType, UnitVisibility } from "#/prisma/client";

const FAVORITES_KIND_KEY = "favorites";

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

    // Lazy create
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
   * Resolve a review to its target work.
   * Returns { targetUnitId, isReview } or null for non-review posts.
   */
  private async resolveReviewTarget(
    targetId: string,
  ): Promise<{ targetUnitId: string; reviewUnitId: string } | null> {
    const post = await prisma.post.findUnique({
      where: { unitId: targetId },
      select: { kind: true, targetUnitId: true },
    });

    if (post?.kind === PostKind.REVIEW && post.targetUnitId) {
      return { targetUnitId: post.targetUnitId, reviewUnitId: targetId };
    }

    return null;
  }

  /**
   * Collect a unit to multiple shelves.
   */
  async collect(
    userId: string,
    input: CollectInput,
  ): Promise<CollectResponse> {
    const { targetId, shelfIds, keywords = [], independent = false } = input;

    const reviewTarget =
      !independent ? await this.resolveReviewTarget(targetId) : null;

    const savedTo: string[] = [];
    let isNew = false;

    await prisma.$transaction(async (tx) => {
      for (const shelfId of shelfIds) {
        // Verify the shelf belongs to the user
        const shelf = await tx.shelf.findFirst({
          where: { unitId: shelfId, unit: { userId } },
        });
        if (!shelf) continue;

        if (reviewTarget && !independent) {
          // Review collection: upsert target work, attach review
          const existing = await tx.shelfItem.findUnique({
            where: {
              shelfUnitId_itemUnitId: {
                shelfUnitId: shelfId,
                itemUnitId: reviewTarget.targetUnitId,
              },
            },
          });

          if (existing) {
            // Merge keywords
            if (keywords.length > 0) {
              const merged = [
                ...new Set([...existing.keywords, ...keywords]),
              ];
              await tx.shelfItem.update({
                where: {
                  shelfUnitId_itemUnitId: {
                    shelfUnitId: shelfId,
                    itemUnitId: reviewTarget.targetUnitId,
                  },
                },
                data: { keywords: merged },
              });
            }
          } else {
            await tx.shelfItem.create({
              data: {
                shelfUnitId: shelfId,
                itemUnitId: reviewTarget.targetUnitId,
                keywords,
              },
            });
            isNew = true;
          }

          // Attach review via ShelfItemReview
          await tx.shelfItemReview.upsert({
            where: {
              shelfUnitId_itemUnitId_reviewUnitId: {
                shelfUnitId: shelfId,
                itemUnitId: reviewTarget.targetUnitId,
                reviewUnitId: reviewTarget.reviewUnitId,
              },
            },
            create: {
              shelfUnitId: shelfId,
              itemUnitId: reviewTarget.targetUnitId,
              reviewUnitId: reviewTarget.reviewUnitId,
            },
            update: {},
          });
        } else {
          // Regular unit collection
          const existing = await tx.shelfItem.findUnique({
            where: {
              shelfUnitId_itemUnitId: {
                shelfUnitId: shelfId,
                itemUnitId: targetId,
              },
            },
          });

          if (existing) {
            if (keywords.length > 0) {
              const merged = [
                ...new Set([...existing.keywords, ...keywords]),
              ];
              await tx.shelfItem.update({
                where: {
                  shelfUnitId_itemUnitId: {
                    shelfUnitId: shelfId,
                    itemUnitId: targetId,
                  },
                },
                data: { keywords: merged },
              });
            }
          } else {
            await tx.shelfItem.create({
              data: {
                shelfUnitId: shelfId,
                itemUnitId: targetId,
                keywords,
              },
            });
            isNew = true;
          }
        }

        savedTo.push(shelfId);
      }

      // Merge keywords into User.keywords
      if (keywords.length > 0) {
        const user = await tx.user.findUniqueOrThrow({
          where: { unitId: userId },
          select: { keywords: true },
        });
        const merged = [...new Set([...user.keywords, ...keywords])];
        if (merged.length <= 500) {
          await tx.user.update({
            where: { unitId: userId },
            data: { keywords: merged },
          });
        }
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
    const reviewTarget = await this.resolveReviewTarget(targetId);
    const itemUnitId = reviewTarget?.targetUnitId ?? targetId;

    const existing = await prisma.shelfItem.findUnique({
      where: {
        shelfUnitId_itemUnitId: {
          shelfUnitId: favShelfId,
          itemUnitId,
        },
      },
    });

    if (existing) {
      // Unfavorite: remove item (cascades ShelfItemReviews)
      await prisma.shelfItem.delete({
        where: {
          shelfUnitId_itemUnitId: {
            shelfUnitId: favShelfId,
            itemUnitId,
          },
        },
      });
      return { isFavorited: false };
    }

    // Favorite: create item
    await prisma.shelfItem.create({
      data: {
        shelfUnitId: favShelfId,
        itemUnitId,
      },
    });

    // If it's a review, attach via ShelfItemReview
    if (reviewTarget) {
      await prisma.shelfItemReview.create({
        data: {
          shelfUnitId: favShelfId,
          itemUnitId,
          reviewUnitId: reviewTarget.reviewUnitId,
        },
      });
    }

    return { isFavorited: true };
  }

  /**
   * Check which shelves contain a given unit.
   */
  async getCollectionStatus(
    userId: string,
    targetId: string,
  ): Promise<CollectionStatusResponse> {
    const reviewTarget = await this.resolveReviewTarget(targetId);
    const itemUnitId = reviewTarget?.targetUnitId ?? targetId;

    const favShelfId = await this.getFavoritesShelfId(userId);

    const shelfItems = await prisma.shelfItem.findMany({
      where: {
        itemUnitId,
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

    const isFavorited = shelfItems.some((si) => si.shelfUnitId === favShelfId);
    const shelves = shelfItems.map((si) => ({
      id: si.shelfUnitId,
      title: si.shelf?.unit?.translations?.[0]?.title ?? null,
    }));

    return { isFavorited, shelves };
  }
}

export const collectionService = new CollectionService();
