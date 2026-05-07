import type {
  ShelfDetailDTO,
  ShelfDTO,
  ShelfItemDTO,
  ShelfItemKind,
  ShelfSummaryDTO,
  ShelfUnitRole,
} from "@rezics/contract";
import { readCoverUrlFromExtra } from "@rezics/contract";
import { prisma } from "#/prisma/client";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type {
  ShelfItemRow,
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

export type ShelfItemProjection = {
  reviewIds: string[];
  tagIds: string[];
};

/**
 * Fetch ShelfUnit rows for a page of slots and group by (itemRef, role) into
 * per-slot `reviewIds` / `tagIds` arrays. Returns a Map keyed by itemRef so
 * `mapShelfItemToDTO` can attach the projection.
 */
export async function buildShelfItemProjection(
  shelfUnitId: string,
  itemRefs: string[],
): Promise<Map<string, ShelfItemProjection>> {
  const out = new Map<string, ShelfItemProjection>();
  if (itemRefs.length === 0) return out;

  const rows = await prisma.shelfUnit.findMany({
    where: {
      shelfUnitId,
      itemRef: { in: itemRefs },
      role: { in: ["review", "tag"] },
    },
    select: { itemRef: true, unitId: true, role: true },
  });

  for (const ref of itemRefs) out.set(ref, { reviewIds: [], tagIds: [] });

  for (const row of rows) {
    const bucket = out.get(row.itemRef);
    if (!bucket) continue;
    const role = row.role as ShelfUnitRole;
    if (role === "review") bucket.reviewIds.push(row.unitId);
    else if (role === "tag") bucket.tagIds.push(row.unitId);
  }

  return out;
}

export function mapShelfItemToDTO(
  item: ShelfItemRow,
  projection?: ShelfItemProjection,
): ShelfItemDTO {
  return {
    shelfUnitId: item.shelfUnitId,
    itemRef: item.itemRef,
    kind: item.kind as ShelfItemKind,
    position: item.position,
    reviewIds: projection?.reviewIds ?? [],
    tagIds: projection?.tagIds ?? [],
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

export function mapShelfToDTO(row: ShelfWithRelations): ShelfDTO {
  return {
    unitId: row.unitId,
    userId: row.unit?.userId ?? undefined,
    user: mapPublicUser(row.unit?.user),
    kindKey: row.kindKey ?? undefined,
    coverUrl: pickShelfCoverUrl(
      row.unit?.defaultLanguage,
      row.unit?.translations,
    ),
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    itemCount: row.itemCount,
    translations: (row.unit?.translations ??
      []) as unknown as ShelfDTO["translations"],
    items: (row.items ?? []).map((i) => mapShelfItemToDTO(i as ShelfItemRow)),
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
    user: mapPublicUser(row.unit?.user),
    kindKey: row.kindKey ?? undefined,
    coverUrl: pickShelfCoverUrl(
      row.unit?.defaultLanguage,
      row.unit?.translations,
    ),
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    itemCount: row.itemCount,
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
    itemCount: row.itemCount,
    tags: row.unit?.unitTags?.map((t) => ({
      tagUnitId: t.tagUnitId,
      score: t.score,
    })),
  };
}
