import type {
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfSummaryDTO,
} from "@rezics/contract";
import type {
  ShelfItemWithRelations,
  ShelfListSelected,
  ShelfWithRelations,
} from "./types";

export function mapShelfItemToDTO(item: ShelfItemWithRelations): ShelfItemDTO {
  return {
    shelfUnitId: item.shelfUnitId,
    itemRef: item.itemRef,
    kind: item.kind as ShelfItemKind,
    position: item.position,
    reviewIds: item.reviewIds,
    tagIds: item.tagIds,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function mapShelfToDTO(row: ShelfWithRelations): ShelfDTO {
  return {
    unitId: row.unitId,
    userId: row.unit?.userId ?? undefined,
    user: row.unit?.user ?? undefined,
    kindKey: row.kindKey ?? undefined,
    coverUrl: row.coverUrl ?? undefined,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: (row.unit?.translations ??
      []) as unknown as ShelfDTO["translations"],
    items: (row.items ?? []).map((i) => mapShelfItemToDTO(i as any)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapShelfDetailToDTO(
  row: ShelfWithRelations,
  itemCount: number,
): ShelfDetailDTO {
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
    user: row.unit?.user ?? undefined,
    kindKey: row.kindKey ?? undefined,
    coverUrl: row.coverUrl ?? undefined,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: (row.unit?.translations ??
      []) as unknown as ShelfDTO["translations"],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapShelfSummaryToDTO(row: ShelfListSelected): ShelfSummaryDTO {
  const title = row.unit?.translations?.[0]?.title ?? null;
  return {
    unitId: row.unitId,
    userId: row.unit?.userId ?? undefined,
    kindKey: row.kindKey ?? undefined,
    coverUrl: row.coverUrl ?? undefined,
    title,
    itemCount: row._count?.items ?? 0,
    tags: row.unit?.unitTags?.map((t) => ({
      tagUnitId: t.tagUnitId,
      score: t.score,
    })),
  };
}
