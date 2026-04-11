import type { ShelfDTO, ShelfItemDTO } from "@rezics/contract";
import { sanitizeUser } from "@/utils/sanitizeUser";
import type { ShelfListSelected, ShelfWithRelations } from "./types";

export function mapShelfItemToDTO(
  item: ShelfWithRelations["items"][number],
): ShelfItemDTO {
  return {
    shelfUnitId: item.shelfUnitId,
    itemUnitId: item.itemUnitId,
    sortOrder: item.sortOrder,
    reviewPostUnitId: item.reviewPostUnitId ?? undefined,
    label: item.label ?? undefined,
    extra: (item.extra as Record<string, unknown>) ?? undefined,
    createdAt: item.createdAt?.toISOString?.() ?? (item.createdAt as any),
    updatedAt: item.updatedAt?.toISOString?.() ?? (item.updatedAt as any),
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
    items: (row.items ?? []).map(mapShelfItemToDTO),
    reactionSummaries: row.unit?.reactionSummaries ?? [],
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
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
