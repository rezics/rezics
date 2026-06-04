import type {
  CollectInput,
  CollectionStatusBatchResponse,
  CollectionStatusResponse,
  CollectResponse,
  ShelfUnitKind,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";
import {
  Post,
  Shelf,
  ShelfUnit,
  ShelfUnitRelation,
  Unit,
  UnitTranslation,
  UserTagApplication,
  UserUnitCollection,
} from "../db/schema";
import { generateBetween } from "./fractional-index";
import {
  createDrizzleSystemShelfClient,
  findSystemShelf,
} from "./system-shelves";
import { enqueueUserUnitCollectionSearchSync } from "./user-unit-collection.service";

const FAVORITES_KIND_KEY = "favorites" as const;
const COLLECTION_STATUS_BATCH_CAP = 100;

type UnitKind = typeof Unit.$inferSelect.type;
type PostKind = NonNullable<typeof Post.$inferSelect.kind>;
type UnitTargetRow = {
  type: UnitKind;
  targetUnitId: string | null;
  postKind: PostKind | null;
};

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

export type CollectionRepository = {
  findFavoritesShelfId(userId: string): Promise<string | null>;
  getUnitTarget(targetId: string): Promise<UnitTargetRow>;
  listUnitTargets(
    targetIds: string[],
  ): Promise<Array<UnitTargetRow & { id: string }>>;
  applyCollectionMetadata(input: {
    userId: string;
    unitId: string;
    tagUnitIds?: string[];
    searchText?: string | null;
  }): Promise<void>;
  collectToShelves(input: {
    userId: string;
    resolved: ResolvedTarget;
    variantUnitId?: string | null;
    shelfIds: string[];
  }): Promise<CollectResponse>;
  hasShelfUnit(shelfId: string, unitId: string): Promise<boolean>;
  removeFavorite(input: {
    shelfId: string;
    resolved: ResolvedTarget;
  }): Promise<void>;
  addFavorite(input: {
    shelfId: string;
    resolved: ResolvedTarget;
  }): Promise<void>;
  listDirectShelfIds(input: {
    userId: string;
    unitIds: string[];
  }): Promise<Array<{ unitId: string; shelfId: string }>>;
  listReviewShelfIds(input: {
    userId: string;
    reviewUnitIds: string[];
  }): Promise<Array<{ childUnitId: string; shelfId: string }>>;
  listShelfTitles(
    shelfIds: string[],
  ): Promise<Array<{ id: string; title: string | null }>>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

function enqueueContainedUnitIdsSync(shelfId: string): Promise<unknown> {
  return serverJobProducer.enqueue(
    createSearchCommand(
      SEARCH_COMMAND_KINDS.contentPatchContainedUnitIds,
      { unitId: shelfId },
      { type: "server", service: "shelf" },
    ),
  );
}

function mapUnitToKind(
  type: UnitKind,
  postKind: PostKind | null,
): ShelfUnitKind {
  if (type === "POST") {
    if (postKind === "CHAPTER") return "chapter";
    if (postKind === "REVIEW") return "review";
    if (postKind === "EXCERPT") return "quote";
    return "post";
  }
  switch (type) {
    case "BOOK":
      return "book";
    case "TAG":
      return "tag";
    case "REALM":
      return "realm";
    case "SHELF":
      return "shelf";
    case "LINK":
      return "link";
    case "GAME":
      return "game";
    case "MEDIA":
      return "media";
    case "IMAGE":
      return "image";
    case "VIDEO":
      return "video";
    default:
      return type.toString().toLowerCase() as ShelfUnitKind;
  }
}

async function nextShelfPosition(tx: any, shelfId: string): Promise<string> {
  const [last] = await tx
    .select({ position: ShelfUnit.position })
    .from(ShelfUnit)
    .where(eq(ShelfUnit.shelfId, shelfId))
    .orderBy(desc(ShelfUnit.position))
    .limit(1);
  return generateBetween(last?.position, undefined);
}

async function findOwnedShelf(tx: any, shelfId: string, userId: string) {
  const [shelf] = await tx
    .select({ unitId: Shelf.unitId })
    .from(Shelf)
    .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
    .where(and(eq(Shelf.unitId, shelfId), eq(Unit.userId, userId)))
    .limit(1);
  return shelf ?? null;
}

async function insertShelfUnit(
  tx: any,
  input: {
    shelfId: string;
    unitId: string;
    kind: ShelfUnitKind;
    variantUnitId?: string | null;
  },
): Promise<boolean> {
  const position = await nextShelfPosition(tx, input.shelfId);
  const rows = await tx
    .insert(ShelfUnit)
    .values({
      shelfId: input.shelfId,
      unitId: input.unitId,
      variantUnitId: input.variantUnitId ?? null,
      kind: input.kind,
      position,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ unitId: ShelfUnit.unitId });
  if (rows.length > 0) {
    await tx
      .update(Shelf)
      .set({
        itemCount: sql`${Shelf.itemCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, input.shelfId));
    return true;
  }
  return false;
}

async function upsertReviewRelation(
  tx: any,
  input: {
    shelfId: string;
    parentUnitId: string;
    childUnitId: string;
  },
): Promise<void> {
  await tx
    .insert(ShelfUnitRelation)
    .values({
      shelfId: input.shelfId,
      parentUnitId: input.parentUnitId,
      childUnitId: input.childUnitId,
      role: "review",
    })
    .onConflictDoNothing();
}

function createDrizzleCollectionRepository(): CollectionRepository {
  return {
    async findFavoritesShelfId(userId) {
      const db = await getServerDb();
      return findSystemShelf(
        userId,
        FAVORITES_KIND_KEY,
        createDrizzleSystemShelfClient(db),
      );
    },
    async getUnitTarget(targetId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({
          type: Unit.type,
          targetUnitId: Unit.targetUnitId,
          postKind: Post.kind,
        })
        .from(Unit)
        .leftJoin(Post, eq(Unit.id, Post.unitId))
        .where(eq(Unit.id, targetId))
        .limit(1);
      if (!unit) throw new Error(`Unit not found: ${targetId}`);
      return unit;
    },
    async listUnitTargets(targetIds) {
      if (targetIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          id: Unit.id,
          type: Unit.type,
          targetUnitId: Unit.targetUnitId,
          postKind: Post.kind,
        })
        .from(Unit)
        .leftJoin(Post, eq(Unit.id, Post.unitId))
        .where(inArray(Unit.id, targetIds));
    },
    async applyCollectionMetadata(input) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        if (input.searchText !== undefined) {
          await tx
            .insert(UserUnitCollection)
            .values({
              userId: input.userId,
              unitId: input.unitId,
              searchText: input.searchText,
              updatedAt: new Date(),
            })
            .onConflictDoUpdate({
              target: [UserUnitCollection.userId, UserUnitCollection.unitId],
              set: { searchText: input.searchText, updatedAt: new Date() },
            });
        }

        if (input.tagUnitIds !== undefined) {
          await tx
            .delete(UserTagApplication)
            .where(
              and(
                eq(UserTagApplication.userId, input.userId),
                eq(UserTagApplication.unitId, input.unitId),
              ),
            );
          const tagUnitIds = Array.from(
            new Set(input.tagUnitIds.map((id) => id.trim()).filter(Boolean)),
          );
          if (tagUnitIds.length > 0) {
            await tx.insert(UserTagApplication).values(
              tagUnitIds.map((tagUnitId, index) => ({
                userId: input.userId,
                unitId: input.unitId,
                tagUnitId,
                position: String(index).padStart(8, "0"),
                updatedAt: new Date(),
              })),
            );
          }
        }
      });
    },
    async collectToShelves(input) {
      const db = await getServerDb();
      const savedTo: string[] = [];
      let isNew = false;
      await db.transaction(async (tx) => {
        for (const shelfId of input.shelfIds) {
          if (shelfId === input.resolved.parentUnitId) {
            throw new AppError(400, "A shelf cannot contain itself");
          }

          const shelf = await findOwnedShelf(tx, shelfId, input.userId);
          if (!shelf) continue;

          const [existingParent] = await tx
            .select({ unitId: ShelfUnit.unitId })
            .from(ShelfUnit)
            .where(
              and(
                eq(ShelfUnit.shelfId, shelfId),
                eq(ShelfUnit.unitId, input.resolved.parentUnitId),
              ),
            )
            .limit(1);

          if (!existingParent) {
            const created = await insertShelfUnit(tx, {
              shelfId,
              unitId: input.resolved.parentUnitId,
              variantUnitId: input.variantUnitId,
              kind: input.resolved.parentKind,
            });
            if (created) isNew = true;
          } else if (input.variantUnitId !== undefined) {
            await tx
              .update(ShelfUnit)
              .set({
                variantUnitId: input.variantUnitId,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(ShelfUnit.shelfId, shelfId),
                  eq(ShelfUnit.unitId, input.resolved.parentUnitId),
                ),
              );
          }

          if (input.resolved.reviewUnitId && input.resolved.reviewKind) {
            const [existingReview] = await tx
              .select({ unitId: ShelfUnit.unitId })
              .from(ShelfUnit)
              .where(
                and(
                  eq(ShelfUnit.shelfId, shelfId),
                  eq(ShelfUnit.unitId, input.resolved.reviewUnitId),
                ),
              )
              .limit(1);
            if (!existingReview) {
              await insertShelfUnit(tx, {
                shelfId,
                unitId: input.resolved.reviewUnitId,
                kind: input.resolved.reviewKind,
              });
            }
            await upsertReviewRelation(tx, {
              shelfId,
              parentUnitId: input.resolved.parentUnitId,
              childUnitId: input.resolved.reviewUnitId,
            });
          }

          savedTo.push(shelfId);
        }
      });
      return { savedTo, isNew };
    },
    async hasShelfUnit(shelfId, unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ unitId: ShelfUnit.unitId })
        .from(ShelfUnit)
        .where(
          and(eq(ShelfUnit.shelfId, shelfId), eq(ShelfUnit.unitId, unitId)),
        )
        .limit(1);
      return Boolean(row);
    },
    async removeFavorite(input) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        const deleted = await tx
          .delete(ShelfUnit)
          .where(
            and(
              eq(ShelfUnit.shelfId, input.shelfId),
              eq(ShelfUnit.unitId, input.resolved.parentUnitId),
            ),
          )
          .returning({ unitId: ShelfUnit.unitId });
        if (deleted.length > 0) {
          await tx
            .update(Shelf)
            .set({
              itemCount: sql`${Shelf.itemCount} - ${deleted.length}`,
              updatedAt: new Date(),
            })
            .where(eq(Shelf.unitId, input.shelfId));
        }
        if (input.resolved.reviewUnitId) {
          const reviewDeleted = await tx
            .delete(ShelfUnit)
            .where(
              and(
                eq(ShelfUnit.shelfId, input.shelfId),
                eq(ShelfUnit.unitId, input.resolved.reviewUnitId),
              ),
            )
            .returning({ unitId: ShelfUnit.unitId });
          if (reviewDeleted.length > 0) {
            await tx
              .update(Shelf)
              .set({
                itemCount: sql`${Shelf.itemCount} - ${reviewDeleted.length}`,
                updatedAt: new Date(),
              })
              .where(eq(Shelf.unitId, input.shelfId));
          }
        }
      });
    },
    async addFavorite(input) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        await insertShelfUnit(tx, {
          shelfId: input.shelfId,
          unitId: input.resolved.parentUnitId,
          kind: input.resolved.parentKind,
        });
        if (input.resolved.reviewUnitId && input.resolved.reviewKind) {
          await insertShelfUnit(tx, {
            shelfId: input.shelfId,
            unitId: input.resolved.reviewUnitId,
            kind: input.resolved.reviewKind,
          });
          await upsertReviewRelation(tx, {
            shelfId: input.shelfId,
            parentUnitId: input.resolved.parentUnitId,
            childUnitId: input.resolved.reviewUnitId,
          });
        }
      });
    },
    async listDirectShelfIds(input) {
      if (input.unitIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({ unitId: ShelfUnit.unitId, shelfId: ShelfUnit.shelfId })
        .from(ShelfUnit)
        .innerJoin(Shelf, eq(ShelfUnit.shelfId, Shelf.unitId))
        .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
        .where(
          and(
            inArray(ShelfUnit.unitId, input.unitIds),
            eq(Unit.userId, input.userId),
          ),
        );
    },
    async listReviewShelfIds(input) {
      if (input.reviewUnitIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          childUnitId: ShelfUnitRelation.childUnitId,
          shelfId: ShelfUnitRelation.shelfId,
        })
        .from(ShelfUnitRelation)
        .innerJoin(Shelf, eq(ShelfUnitRelation.shelfId, Shelf.unitId))
        .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
        .where(
          and(
            inArray(ShelfUnitRelation.childUnitId, input.reviewUnitIds),
            eq(ShelfUnitRelation.role, "review"),
            eq(Unit.userId, input.userId),
          ),
        );
    },
    async listShelfTitles(shelfIds) {
      if (shelfIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          id: Shelf.unitId,
          title: UnitTranslation.title,
        })
        .from(Shelf)
        .leftJoin(
          UnitTranslation,
          and(
            eq(UnitTranslation.unitId, Shelf.unitId),
            eq(UnitTranslation.language, "en"),
          ),
        )
        .where(inArray(Shelf.unitId, shelfIds));
    },
  };
}

export class CollectionService {
  constructor(
    private readonly repository: CollectionRepository = createDrizzleCollectionRepository(),
  ) {}

  private async getFavoritesShelfId(userId: string): Promise<string> {
    const shelfId = await this.repository.findFavoritesShelfId(userId);
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
   * - If `targetId` is a REVIEW post whose Unit has a canonical target, the
   *   target work is the parent and the review itself is threaded back as a child.
   * - Otherwise the target is the parent.
   */
  private async resolveTarget(
    targetId: string,
    independent: boolean,
  ): Promise<ResolvedTarget> {
    const unit = await this.repository.getUnitTarget(targetId);

    if (
      !independent &&
      unit.type === "POST" &&
      unit.postKind === "REVIEW" &&
      unit.targetUnitId
    ) {
      const target = await this.repository.getUnitTarget(unit.targetUnitId);
      return {
        parentUnitId: unit.targetUnitId,
        parentKind: mapUnitToKind(target.type, target.postKind),
        reviewUnitId: targetId,
        reviewKind: "review",
      };
    }

    return {
      parentUnitId: targetId,
      parentKind: mapUnitToKind(unit.type, unit.postKind),
    };
  }

  /**
   * Collect a unit to multiple shelves.
   */
  async collect(userId: string, input: CollectInput): Promise<CollectResponse> {
    const {
      targetId,
      variantUnitId,
      shelfIds,
      independent = false,
      tagUnitIds,
      searchText,
    } = input;
    const resolved = await this.resolveTarget(targetId, independent);

    await this.repository.applyCollectionMetadata({
      userId,
      unitId: resolved.parentUnitId,
      tagUnitIds,
      searchText,
    });

    const result = await this.repository.collectToShelves({
      userId,
      resolved,
      variantUnitId,
      shelfIds,
    });

    if (searchText !== undefined) {
      await enqueueUserUnitCollectionSearchSync(userId, resolved.parentUnitId);
    }

    await Promise.all(
      result.savedTo.map((shelfId) => enqueueContainedUnitIdsSync(shelfId)),
    );

    return result;
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

    const existing = await this.repository.hasShelfUnit(
      favShelfId,
      resolved.parentUnitId,
    );

    if (existing) {
      await this.repository.removeFavorite({ shelfId: favShelfId, resolved });
      await enqueueContainedUnitIdsSync(favShelfId);
      return { isFavorited: false };
    }

    await this.repository.addFavorite({ shelfId: favShelfId, resolved });

    await enqueueContainedUnitIdsSync(favShelfId);
    return { isFavorited: true };
  }

  async getCollectionStatus(
    userId: string,
    targetId: string,
  ): Promise<CollectionStatusResponse> {
    const resolved = await this.resolveTarget(targetId, false);
    const favShelfId = await this.getFavoritesShelfId(userId);

    const shelfRows = resolved.reviewUnitId
      ? await this.repository.listReviewShelfIds({
          userId,
          reviewUnitIds: [resolved.reviewUnitId],
        })
      : await this.repository.listDirectShelfIds({
          userId,
          unitIds: [resolved.parentUnitId],
        });
    const shelfIds = shelfRows.map((row) => row.shelfId);

    if (shelfIds.length === 0) {
      return { isFavorited: false, shelves: [] };
    }

    const shelfTitleById = new Map(
      (await this.repository.listShelfTitles(shelfIds)).map((shelf) => [
        shelf.id,
        shelf.title,
      ]),
    );

    return {
      isFavorited: shelfIds.includes(favShelfId),
      shelves: shelfIds.map((shelfId) => ({
        id: shelfId,
        title: shelfTitleById.get(shelfId) ?? null,
      })),
    };
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

    const units = await this.repository.listUnitTargets(normalizedTargetIds);
    const reviewTargetIds = new Set<string>();
    for (const unit of units) {
      if (
        unit.type === "POST" &&
        unit.postKind === "REVIEW" &&
        unit.targetUnitId
      ) {
        reviewTargetIds.add(unit.targetUnitId);
      }
    }

    const reviewTargets =
      reviewTargetIds.size > 0
        ? await this.repository.listUnitTargets([...reviewTargetIds])
        : [];
    const reviewTargetById = new Map(
      reviewTargets.map((unit) => [unit.id, unit]),
    );

    const resolvedTargets: BatchResolvedTarget[] = units.map((unit) => {
      if (
        unit.type === "POST" &&
        unit.postKind === "REVIEW" &&
        unit.targetUnitId
      ) {
        const target = reviewTargetById.get(unit.targetUnitId);
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
      this.repository.listDirectShelfIds({ userId, unitIds: parentUnitIds }),
      this.repository.listReviewShelfIds({ userId, reviewUnitIds }),
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

    const shelfTitleById = new Map(
      (await this.repository.listShelfTitles([...allShelfIds])).map((shelf) => [
        shelf.id,
        shelf.title,
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
