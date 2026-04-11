import type {
  ShelfDTO,
  ShelfDetailDTO,
  ShelfItemDTO,
  ShelfItemReviewDTO,
  ShelfSummaryDTO,
} from "@rezics/contract";
import { sanitizeUser } from "@/utils/sanitizeUser";
import type {
  ShelfItemWithRelations,
  ShelfListSelected,
  ShelfWithRelations,
} from "./types";

export function mapShelfItemReviewToDTO(
  review: ShelfItemWithRelations["reviews"][number],
): ShelfItemReviewDTO {
  return {
    shelfUnitId: review.shelfUnitId,
    itemUnitId: review.itemUnitId,
    reviewUnitId: review.reviewUnitId,
    addedAt: review.addedAt?.toISOString?.() ?? (review.addedAt as any),
  };
}

export function mapShelfItemToDTO(
  item: ShelfItemWithRelations,
): ShelfItemDTO {
  return {
    shelfUnitId: item.shelfUnitId,
    itemUnitId: item.itemUnitId,
    sortOrder: item.sortOrder,
    keywords: item.keywords,
    label: item.label ?? undefined,
    extra: (item.extra as Record<string, unknown>) ?? undefined,
    createdAt: item.createdAt?.toISOString?.() ?? (item.createdAt as any),
    updatedAt: item.updatedAt?.toISOString?.() ?? (item.updatedAt as any),
    reviews: (item.reviews ?? []).map(mapShelfItemReviewToDTO),
    item: item.item
      ? {
          id: item.item.id,
          type: item.item.type,
          translations: item.item.translations ?? [],
          extra: (item.item.extra as Record<string, unknown>) ?? undefined,
        }
      : undefined,
  };
}

export function mapShelfToDTO(row: ShelfWithRelations): ShelfDTO {
  return {
    unitId: row.unitId,
    userId: row.unit?.userId ?? undefined,
    user: row.unit?.user ? sanitizeUser(row.unit.user) : undefined,
    kindKey: row.kindKey ?? undefined,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: row.unit?.translations ?? [],
    items: (row.items ?? []).map((i) => mapShelfItemToDTO(i as any)),
    reactionSummaries: row.unit?.reactionSummaries ?? [],
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
  };
}

export function mapShelfDetailToDTO(row: ShelfWithRelations, itemCount: number): ShelfDetailDTO {
  return {
    ...mapShelfToDTO(row),
    itemCount,
    tags: row.unit?.unitTags?.map((t) => ({
      tagUnitId: t.tagUnitId,
      score: t.score,
    })),
  };
}

export function mapShelfListRowToDTO(row: ShelfListSelected): ShelfDTO {
  return {
    unitId: row.unitId,
    userId: row.unit?.userId ?? undefined,
    user: row.unit?.user ? sanitizeUser(row.unit.user) : undefined,
    kindKey: row.kindKey ?? undefined,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: row.unit?.translations ?? [],
    reactionSummaries: row.unit?.reactionSummaries ?? [],
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
  };
}

export function mapShelfSummaryToDTO(row: ShelfListSelected): ShelfSummaryDTO {
  const title = row.unit?.translations?.[0]?.title ?? null;
  return {
    unitId: row.unitId,
    userId: row.unit?.userId ?? undefined,
    kindKey: row.kindKey ?? undefined,
    title,
    itemCount: row._count?.items ?? 0,
    tags: row.unit?.unitTags?.map((t) => ({
      tagUnitId: t.tagUnitId,
      score: t.score,
    })),
  };
}
