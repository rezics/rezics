import type {
  AddToShelvesInput,
  AddToShelvesResponse,
  ShelfItemKind,
  ShelfItemParentRole,
  ShelfItemStatusBatchResponse,
  ShelfItemStatusResponse,
  ToggleFavoriteResponse,
} from "@rezics/contract";
import { FAVORITES_SHELF_SLUG } from "@rezics/contract";
import { createSearchCommand, SEARCH_COMMAND_KINDS } from "@rezics/job";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { serverJobProducer } from "@/job/job-boundary";
import { AppError } from "@/utils/errors";
import {
  Post,
  Shelf,
  ShelfItem,
  Unit,
  UnitSupportLanguage,
  UnitTranslation,
  UserTagApplication,
} from "../db/schema";
import { generateBetween } from "./fractional-index";
import {
  createDrizzleSystemShelfClient,
  findReservedShelfBySlug,
} from "./system-shelves";
import { enqueueShelfItemSourceSearchSync } from "./user-shelf-item.service";

const SHELF_ITEM_STATUS_BATCH_CAP = 100;

type UnitKind = typeof Unit.$inferSelect.type;
type PostKind = NonNullable<typeof Post.$inferSelect.kind>;
type CatalogEntryKind = typeof Unit.$inferSelect.catalogEntryKind;
type UnitTargetRow = {
  type: UnitKind;
  catalogEntryKind: CatalogEntryKind;
  targetUnitId: string | null;
  postKind: PostKind | null;
};

interface ResolvedTarget {
  /**
   * Unit id of the parent shelf item (the target work, or the target itself).
   * 父级 shelf item 的 unit id（目标作品，或目标本身）。
   */
  parentUnitId: string;
  /**
   * Kind discriminator for the parent shelf item.
   * 父级 shelf item 的 kind 判别符。
   */
  parentKind: ShelfItemKind;
  /**
   * If the original targetId is a review post, its unit id and kind; else undefined.
   * 若原始 targetId 是 review 帖子，则为其 unit id 与 kind；否则为 undefined。
   */
  reviewUnitId?: string;
  reviewKind?: ShelfItemKind;
  /**
   * API-level VARIANT target. Adding to shelves resolves this to a child ShelfItem;
   * it is never stored as weak context on the parent row.
   * API 层的 VARIANT 目标。加入书架会将其解析为子级 ShelfItem；
   * 不再作为弱上下文存到父级行。
   */
  variantUnitId?: string;
  variantKind?: ShelfItemKind;
}

interface BatchResolvedTarget {
  targetId: string;
  parentUnitId: string;
  reviewUnitId?: string;
  variantUnitId?: string;
}

export type ShelfItemActionRepository = {
  findFavoritesShelfId(userId: string): Promise<string | null>;
  getUnitTarget(targetId: string): Promise<UnitTargetRow>;
  listUnitTargets(
    targetIds: string[],
  ): Promise<Array<UnitTargetRow & { id: string }>>;
  applyShelfItemMetadata(input: {
    userId: string;
    unitId: string;
    tagUnitIds?: string[];
    searchText?: string | null;
  }): Promise<void>;
  addToShelves(input: {
    userId: string;
    resolved: ResolvedTarget;
    searchText?: string | null;
    shelfIds: string[];
  }): Promise<AddToShelvesResponse>;
  hasShelfItem(shelfId: string, unitId: string): Promise<boolean>;
  hasVariantShelfItem(shelfId: string, variantUnitId: string): Promise<boolean>;
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
  listVariantShelfIds(input: {
    userId: string;
    variantUnitIds: string[];
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
): ShelfItemKind {
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
      return type.toString().toLowerCase() as ShelfItemKind;
  }
}

async function nextShelfPosition(tx: any, shelfId: string): Promise<string> {
  const [last] = await tx
    .select({ position: ShelfItem.position })
    .from(ShelfItem)
    .where(eq(ShelfItem.shelfId, shelfId))
    .orderBy(desc(ShelfItem.position))
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

async function insertShelfItem(
  tx: any,
  input: {
    shelfId: string;
    unitId: string;
    kind: ShelfItemKind;
    parentUnitId?: string | null;
    parentRole?: string | null;
    searchText?: string | null;
  },
): Promise<boolean> {
  const position = await nextShelfPosition(tx, input.shelfId);
  const rows = await tx
    .insert(ShelfItem)
    .values({
      shelfId: input.shelfId,
      itemType: "unit",
      itemId: input.unitId,
      kind: input.kind,
      parentItemType: input.parentUnitId ? "unit" : null,
      parentItemId: input.parentUnitId ?? null,
      parentRole: input.parentRole ?? null,
      position,
      searchText: input.searchText ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ itemId: ShelfItem.itemId });
  if (rows.length > 0) {
    await tx
      .update(Shelf)
      .set({
        itemCount: sql`${Shelf.itemCount} + 1`,
        ...(input.parentUnitId
          ? {}
          : { rootItemCount: sql`${Shelf.rootItemCount} + 1` }),
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, input.shelfId));
    return true;
  }
  return false;
}

async function upsertChildRelation(
  tx: any,
  input: {
    shelfId: string;
    parentUnitId: string;
    childUnitId: string;
    role: ShelfItemParentRole;
  },
): Promise<void> {
  const [before] = await tx
    .select({ parentUnitId: ShelfItem.parentItemId })
    .from(ShelfItem)
    .where(
      and(
        eq(ShelfItem.shelfId, input.shelfId),
        eq(ShelfItem.itemId, input.childUnitId),
      ),
    )
    .limit(1);
  const updated = await tx
    .update(ShelfItem)
    .set({
      parentItemType: "unit",
      parentItemId: input.parentUnitId,
      parentRole: input.role,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(ShelfItem.shelfId, input.shelfId),
        eq(ShelfItem.itemId, input.childUnitId),
      ),
    )
    .returning({
      unitId: ShelfItem.itemId,
      parentUnitId: ShelfItem.parentItemId,
    });
  if (!before?.parentUnitId && updated.length > 0) {
    await tx
      .update(Shelf)
      .set({
        rootItemCount: sql`${Shelf.rootItemCount} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(Shelf.unitId, input.shelfId));
  }
}

function createDrizzleShelfItemActionRepository(): ShelfItemActionRepository {
  return {
    async findFavoritesShelfId(userId) {
      const db = await getServerDb();
      return findReservedShelfBySlug(
        userId,
        FAVORITES_SHELF_SLUG,
        createDrizzleSystemShelfClient(db),
      );
    },
    async getUnitTarget(targetId) {
      const db = await getServerDb();
      const [unit] = await db
        .select({
          type: Unit.type,
          catalogEntryKind: Unit.catalogEntryKind,
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
          catalogEntryKind: Unit.catalogEntryKind,
          targetUnitId: Unit.targetUnitId,
          postKind: Post.kind,
        })
        .from(Unit)
        .leftJoin(Post, eq(Unit.id, Post.unitId))
        .where(inArray(Unit.id, targetIds));
    },
    async applyShelfItemMetadata(input) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
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
    async addToShelves(input) {
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
            .select({ unitId: ShelfItem.itemId })
            .from(ShelfItem)
            .where(
              and(
                eq(ShelfItem.shelfId, shelfId),
                eq(ShelfItem.itemId, input.resolved.parentUnitId),
              ),
            )
            .limit(1);

          if (!existingParent) {
            const created = await insertShelfItem(tx, {
              shelfId,
              unitId: input.resolved.parentUnitId,
              kind: input.resolved.parentKind,
              searchText: input.searchText,
            });
            if (created) isNew = true;
          } else if (input.searchText !== undefined) {
            await tx
              .update(ShelfItem)
              .set({
                searchText: input.searchText,
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(ShelfItem.shelfId, shelfId),
                  eq(ShelfItem.itemId, input.resolved.parentUnitId),
                ),
              );
          }

          if (input.resolved.reviewUnitId && input.resolved.reviewKind) {
            const [existingReview] = await tx
              .select({ unitId: ShelfItem.itemId })
              .from(ShelfItem)
              .where(
                and(
                  eq(ShelfItem.shelfId, shelfId),
                  eq(ShelfItem.itemId, input.resolved.reviewUnitId),
                ),
              )
              .limit(1);
            if (!existingReview) {
              await insertShelfItem(tx, {
                shelfId,
                unitId: input.resolved.reviewUnitId,
                kind: input.resolved.reviewKind,
                parentUnitId: input.resolved.parentUnitId,
                parentRole: "review",
              });
            }
            await upsertChildRelation(tx, {
              shelfId,
              parentUnitId: input.resolved.parentUnitId,
              childUnitId: input.resolved.reviewUnitId,
              role: "review",
            });
          }

          if (input.resolved.variantUnitId && input.resolved.variantKind) {
            const [existingVariant] = await tx
              .select({ unitId: ShelfItem.itemId })
              .from(ShelfItem)
              .where(
                and(
                  eq(ShelfItem.shelfId, shelfId),
                  eq(ShelfItem.itemId, input.resolved.variantUnitId),
                ),
              )
              .limit(1);
            if (!existingVariant) {
              const created = await insertShelfItem(tx, {
                shelfId,
                unitId: input.resolved.variantUnitId,
                kind: input.resolved.variantKind,
                parentUnitId: input.resolved.parentUnitId,
                parentRole: "variant",
              });
              if (created) isNew = true;
            }
            await upsertChildRelation(tx, {
              shelfId,
              parentUnitId: input.resolved.parentUnitId,
              childUnitId: input.resolved.variantUnitId,
              role: "variant",
            });
          }

          savedTo.push(shelfId);
        }
      });
      return { savedTo, isNew };
    },
    async hasShelfItem(shelfId, unitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ unitId: ShelfItem.itemId })
        .from(ShelfItem)
        .where(
          and(eq(ShelfItem.shelfId, shelfId), eq(ShelfItem.itemId, unitId)),
        )
        .limit(1);
      return Boolean(row);
    },
    async hasVariantShelfItem(shelfId, variantUnitId) {
      const db = await getServerDb();
      const [row] = await db
        .select({ unitId: ShelfItem.itemId })
        .from(ShelfItem)
        .where(
          and(
            eq(ShelfItem.shelfId, shelfId),
            eq(ShelfItem.itemId, variantUnitId),
            eq(ShelfItem.parentRole, "variant"),
          ),
        )
        .limit(1);
      return Boolean(row);
    },
    async removeFavorite(input) {
      const db = await getServerDb();
      await db.transaction(async (tx) => {
        if (input.resolved.variantUnitId) {
          const variantDeleted = await tx
            .delete(ShelfItem)
            .where(
              and(
                eq(ShelfItem.shelfId, input.shelfId),
                eq(ShelfItem.itemId, input.resolved.variantUnitId),
                eq(ShelfItem.parentRole, "variant"),
              ),
            )
            .returning({ unitId: ShelfItem.itemId });
          if (variantDeleted.length > 0) {
            await tx
              .update(Shelf)
              .set({
                itemCount: sql`${Shelf.itemCount} - ${variantDeleted.length}`,
                updatedAt: new Date(),
              })
              .where(eq(Shelf.unitId, input.shelfId));
          }
          return;
        }

        const deleted = await tx
          .delete(ShelfItem)
          .where(
            and(
              eq(ShelfItem.shelfId, input.shelfId),
              eq(ShelfItem.itemId, input.resolved.parentUnitId),
            ),
          )
          .returning({
            unitId: ShelfItem.itemId,
            parentUnitId: ShelfItem.parentItemId,
          });
        if (deleted.length > 0) {
          const rootRows = deleted.filter((row) => !row.parentUnitId).length;
          await tx
            .update(Shelf)
            .set({
              itemCount: sql`${Shelf.itemCount} - ${deleted.length}`,
              ...(rootRows > 0
                ? { rootItemCount: sql`${Shelf.rootItemCount} - ${rootRows}` }
                : {}),
              updatedAt: new Date(),
            })
            .where(eq(Shelf.unitId, input.shelfId));
        }
        if (input.resolved.reviewUnitId) {
          const reviewDeleted = await tx
            .delete(ShelfItem)
            .where(
              and(
                eq(ShelfItem.shelfId, input.shelfId),
                eq(ShelfItem.itemId, input.resolved.reviewUnitId),
              ),
            )
            .returning({
              unitId: ShelfItem.itemId,
              parentUnitId: ShelfItem.parentItemId,
            });
          if (reviewDeleted.length > 0) {
            const rootRows = reviewDeleted.filter(
              (row) => !row.parentUnitId,
            ).length;
            await tx
              .update(Shelf)
              .set({
                itemCount: sql`${Shelf.itemCount} - ${reviewDeleted.length}`,
                ...(rootRows > 0
                  ? {
                      rootItemCount: sql`${Shelf.rootItemCount} - ${rootRows}`,
                    }
                  : {}),
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
        await insertShelfItem(tx, {
          shelfId: input.shelfId,
          unitId: input.resolved.parentUnitId,
          kind: input.resolved.parentKind,
        });
        if (input.resolved.variantUnitId && input.resolved.variantKind) {
          await insertShelfItem(tx, {
            shelfId: input.shelfId,
            unitId: input.resolved.variantUnitId,
            kind: input.resolved.variantKind,
            parentUnitId: input.resolved.parentUnitId,
            parentRole: "variant",
          });
          await upsertChildRelation(tx, {
            shelfId: input.shelfId,
            parentUnitId: input.resolved.parentUnitId,
            childUnitId: input.resolved.variantUnitId,
            role: "variant",
          });
        }
        if (input.resolved.reviewUnitId && input.resolved.reviewKind) {
          await insertShelfItem(tx, {
            shelfId: input.shelfId,
            unitId: input.resolved.reviewUnitId,
            kind: input.resolved.reviewKind,
            parentUnitId: input.resolved.parentUnitId,
            parentRole: "review",
          });
          await upsertChildRelation(tx, {
            shelfId: input.shelfId,
            parentUnitId: input.resolved.parentUnitId,
            childUnitId: input.resolved.reviewUnitId,
            role: "review",
          });
        }
      });
    },
    async listDirectShelfIds(input) {
      if (input.unitIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({ unitId: ShelfItem.itemId, shelfId: ShelfItem.shelfId })
        .from(ShelfItem)
        .innerJoin(Shelf, eq(ShelfItem.shelfId, Shelf.unitId))
        .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
        .where(
          and(
            inArray(ShelfItem.itemId, input.unitIds),
            isNull(ShelfItem.parentItemId),
            eq(Unit.userId, input.userId),
          ),
        );
    },
    async listReviewShelfIds(input) {
      if (input.reviewUnitIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          childUnitId: ShelfItem.itemId,
          shelfId: ShelfItem.shelfId,
        })
        .from(ShelfItem)
        .innerJoin(Shelf, eq(ShelfItem.shelfId, Shelf.unitId))
        .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
        .where(
          and(
            inArray(ShelfItem.itemId, input.reviewUnitIds),
            eq(ShelfItem.parentRole, "review"),
            eq(Unit.userId, input.userId),
          ),
        );
    },
    async listVariantShelfIds(input) {
      if (input.variantUnitIds.length === 0) return [];
      const db = await getServerDb();
      return db
        .select({
          childUnitId: ShelfItem.itemId,
          shelfId: ShelfItem.shelfId,
        })
        .from(ShelfItem)
        .innerJoin(Shelf, eq(ShelfItem.shelfId, Shelf.unitId))
        .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
        .where(
          and(
            inArray(ShelfItem.itemId, input.variantUnitIds),
            eq(ShelfItem.parentRole, "variant"),
            eq(Unit.userId, input.userId),
          ),
        );
    },
    async listShelfTitles(shelfIds) {
      if (shelfIds.length === 0) return [];
      const db = await getServerDb();
      const rows = await db
        .select({
          id: Shelf.unitId,
          defaultLanguage: Unit.defaultLanguage,
          language: UnitTranslation.language,
          title: UnitTranslation.title,
          supportLanguage: UnitSupportLanguage.language,
          supportIsPrimary: UnitSupportLanguage.isPrimary,
          supportPosition: UnitSupportLanguage.position,
        })
        .from(Shelf)
        .innerJoin(Unit, eq(Shelf.unitId, Unit.id))
        .leftJoin(UnitTranslation, eq(UnitTranslation.unitId, Shelf.unitId))
        .leftJoin(
          UnitSupportLanguage,
          and(
            eq(UnitSupportLanguage.unitId, Shelf.unitId),
            eq(UnitSupportLanguage.language, UnitTranslation.language),
          ),
        )
        .where(inArray(Shelf.unitId, shelfIds))
        .orderBy(
          asc(Shelf.unitId),
          desc(UnitSupportLanguage.isPrimary),
          asc(UnitSupportLanguage.position),
          asc(UnitTranslation.language),
        );

      const byShelf = new Map<string, typeof rows>();
      for (const row of rows) {
        const current = byShelf.get(row.id) ?? [];
        current.push(row);
        byShelf.set(row.id, current);
      }

      return [...byShelf.entries()].map(([id, titleRows]) => {
        const title =
          titleRows.find(
            (row) =>
              row.language === row.defaultLanguage &&
              typeof row.title === "string",
          )?.title ??
          titleRows.find((row) => row.supportIsPrimary && row.title)?.title ??
          titleRows.find((row) => row.title)?.title ??
          null;
        return { id, title };
      });
    },
  };
}

export class ShelfItemActionService {
  constructor(
    private readonly repository: ShelfItemActionRepository = createDrizzleShelfItemActionRepository(),
  ) {}

  private async getFavoritesShelfId(userId: string): Promise<string> {
    const shelfId = await this.repository.findFavoritesShelfId(userId);
    if (!shelfId) {
      throw new AppError(404, "Favorites shelf not found", {
        code: "system_shelf_missing",
        details: { slug: FAVORITES_SHELF_SLUG },
      });
    }
    return shelfId;
  }

  /**
   * Resolve the add-to-shelves target to a parent shelf item + optional child.
   *
   * - If `targetId` is a REVIEW post whose Unit has a canonical target, the
   *   target work is the parent and the review itself is threaded back as a child.
   * - If `targetId` is a catalog VARIANT, or a selected `variantUnitId`
   *   points back to the target work, the main catalog Unit is the parent and
   *   the variant itself is threaded back as a child.
   * - Otherwise the target is the parent.
   * 将收藏目标解析为一个父级 shelf item + 可选子项。
   *
   * - 若 `targetId` 是其 Unit 拥有规范目标的 REVIEW 帖子，则目标作品为父级，
   *   而 review 本身作为子项串接回来。
   * - 若 `targetId` 是目录 VARIANT，或 `variantUnitId` 指回目标作品，
   *   则主目录 Unit 为父级，而变体本身作为子项串接回来。
   * - 否则该目标即为父级。
   */
  private async resolveTarget(
    targetId: string,
    independent: boolean,
    selectedVariantUnitId?: string,
  ): Promise<ResolvedTarget> {
    const unit = await this.repository.getUnitTarget(targetId);

    if (
      !independent &&
      unit.catalogEntryKind === "VARIANT" &&
      unit.targetUnitId
    ) {
      const target = await this.repository.getUnitTarget(unit.targetUnitId);
      return {
        parentUnitId: unit.targetUnitId,
        parentKind: mapUnitToKind(target.type, target.postKind),
        variantUnitId: targetId,
        variantKind: mapUnitToKind(unit.type, unit.postKind),
      };
    }

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

    if (selectedVariantUnitId?.trim()) {
      const variantUnitId = selectedVariantUnitId.trim();
      try {
        const variant = await this.repository.getUnitTarget(variantUnitId);
        if (
          variant.catalogEntryKind === "VARIANT" &&
          variant.targetUnitId === targetId
        ) {
          return {
            parentUnitId: targetId,
            parentKind: mapUnitToKind(unit.type, unit.postKind),
            variantUnitId,
            variantKind: mapUnitToKind(variant.type, variant.postKind),
          };
        }
      } catch {
        throw new AppError(400, "invalid_variant_unit");
      }
      throw new AppError(400, "variant_target_mismatch");
    }

    return {
      parentUnitId: targetId,
      parentKind: mapUnitToKind(unit.type, unit.postKind),
    };
  }

  /**
   * Add a unit to shelves to multiple shelves.
   * 将一个 unit 收藏到多个 shelf。
   */
  async addToShelves(
    userId: string,
    input: AddToShelvesInput,
  ): Promise<AddToShelvesResponse> {
    const {
      targetId,
      variantUnitId,
      shelfIds,
      independent = false,
      tagUnitIds,
      searchText,
    } = input;
    const resolved = await this.resolveTarget(
      targetId,
      independent,
      variantUnitId,
    );

    await this.repository.applyShelfItemMetadata({
      userId,
      unitId: resolved.parentUnitId,
      tagUnitIds,
    });

    const result = await this.repository.addToShelves({
      userId,
      resolved,
      searchText,
      shelfIds,
    });

    if (searchText !== undefined) {
      await enqueueShelfItemSourceSearchSync("unit", resolved.parentUnitId);
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

    const existing = resolved.variantUnitId
      ? await this.repository.hasVariantShelfItem(
          favShelfId,
          resolved.variantUnitId,
        )
      : await this.repository.hasShelfItem(favShelfId, resolved.parentUnitId);

    if (existing) {
      await this.repository.removeFavorite({ shelfId: favShelfId, resolved });
      await enqueueContainedUnitIdsSync(favShelfId);
      return { isFavorited: false };
    }

    await this.repository.addFavorite({ shelfId: favShelfId, resolved });

    await enqueueContainedUnitIdsSync(favShelfId);
    return { isFavorited: true };
  }

  async getShelfItemStatus(
    userId: string,
    targetId: string,
  ): Promise<ShelfItemStatusResponse> {
    const resolved = await this.resolveTarget(targetId, false);
    const favShelfId = await this.getFavoritesShelfId(userId);

    const shelfRows = resolved.variantUnitId
      ? await this.repository.listVariantShelfIds({
          userId,
          variantUnitIds: [resolved.variantUnitId],
        })
      : resolved.reviewUnitId
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

  async getShelfItemStatusBatch(
    userId: string,
    targetIds: string[],
  ): Promise<ShelfItemStatusBatchResponse> {
    const normalizedTargetIds = Array.from(
      new Set(targetIds.map((id) => id.trim()).filter(Boolean)),
    );

    if (normalizedTargetIds.length > SHELF_ITEM_STATUS_BATCH_CAP) {
      throw new AppError(
        400,
        `Shelf item status batch is limited to ${SHELF_ITEM_STATUS_BATCH_CAP} targets`,
      );
    }

    const statusesByTarget: ShelfItemStatusBatchResponse["statusesByTarget"] =
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
    const variantTargetIds = new Set<string>();
    for (const unit of units) {
      if (
        unit.type === "POST" &&
        unit.postKind === "REVIEW" &&
        unit.targetUnitId
      ) {
        reviewTargetIds.add(unit.targetUnitId);
      }
      if (unit.catalogEntryKind === "VARIANT" && unit.targetUnitId) {
        variantTargetIds.add(unit.targetUnitId);
      }
    }

    const parentTargetIds = [
      ...new Set([...reviewTargetIds, ...variantTargetIds]),
    ];
    const parentTargets =
      parentTargetIds.length > 0
        ? await this.repository.listUnitTargets(parentTargetIds)
        : [];
    const reviewTargetById = new Map(
      parentTargets.map((unit) => [unit.id, unit]),
    );

    const resolvedTargets: BatchResolvedTarget[] = units.map((unit) => {
      if (unit.catalogEntryKind === "VARIANT" && unit.targetUnitId) {
        const target = reviewTargetById.get(unit.targetUnitId);
        if (target) {
          return {
            targetId: unit.id,
            parentUnitId: target.id,
            variantUnitId: unit.id,
          };
        }
      }

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
          .filter((target) => !target.reviewUnitId && !target.variantUnitId)
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
    const variantUnitIds = [
      ...new Set(
        resolvedTargets
          .map((target) => target.variantUnitId)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [directRows, reviewRows, variantRows] = await Promise.all([
      this.repository.listDirectShelfIds({ userId, unitIds: parentUnitIds }),
      this.repository.listReviewShelfIds({ userId, reviewUnitIds }),
      this.repository.listVariantShelfIds({ userId, variantUnitIds }),
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
    const variantShelfIdsByUnitId = new Map<string, string[]>();
    for (const row of variantRows) {
      const ids = variantShelfIdsByUnitId.get(row.childUnitId) ?? [];
      ids.push(row.shelfId);
      variantShelfIdsByUnitId.set(row.childUnitId, ids);
    }

    const allShelfIds = new Set<string>();
    for (const target of resolvedTargets) {
      const shelfIds = target.variantUnitId
        ? (variantShelfIdsByUnitId.get(target.variantUnitId) ?? [])
        : target.reviewUnitId
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
      const shelfIds = target.variantUnitId
        ? (variantShelfIdsByUnitId.get(target.variantUnitId) ?? [])
        : target.reviewUnitId
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

export const shelfItemActionService = new ShelfItemActionService();
