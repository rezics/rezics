import type {
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfSummaryDTO,
} from "@rezics/contract";
import { readCoverUrlFromExtra } from "@rezics/contract";
import type {
  ShelfItemWithRelations,
  ShelfListSelected,
  ShelfWithRelations,
} from "./types";

type ShelfTranslationLike = {
  language: string;
  extra: unknown;
};

function pickShelfCoverUrl(
  defaultLanguage: string | null | undefined,
  translations: readonly ShelfTranslationLike[] | undefined,
): string | undefined {
  const list = translations ?? [];
  if (list.length === 0) return undefined;
  const ordered = [
    defaultLanguage
      ? list.find((t) => t.language === defaultLanguage)
      : undefined,
    list.find((t) => t.language === "en"),
    ...list,
  ];
  for (const tr of ordered) {
    const url = readCoverUrlFromExtra(tr?.extra);
    if (url) return url;
  }
  return undefined;
}

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
    coverUrl: pickShelfCoverUrl(
      row.unit?.defaultLanguage,
      row.unit?.translations,
    ),
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
    coverUrl: pickShelfCoverUrl(
      row.unit?.defaultLanguage,
      row.unit?.translations,
    ),
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
    coverUrl: pickShelfCoverUrl(
      row.unit?.defaultLanguage,
      row.unit?.translations,
    ),
    title,
    itemCount: row._count?.items ?? 0,
    tags: row.unit?.unitTags?.map((t) => ({
      tagUnitId: t.tagUnitId,
      score: t.score,
    })),
  };
}
