import type {
  ShelfDetailDTO,
  ShelfDTO,
  ShelfSummaryDTO,
  ShelfUnitDTO,
  ShelfUnitKind,
  ShelfUnitRelationDTO,
  ShelfUnitRelationRole,
} from "@rezics/contract";
import { readCoverUrlFromExtra } from "@rezics/contract";
import { resolveStoredLicenseSlug } from "@/unit/publication-policy";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type {
  ShelfListSelected,
  ShelfUnitRelationRow,
  ShelfUnitRow,
  ShelfWithMetadata,
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

export function mapShelfUnitToDTO(row: ShelfUnitRow): ShelfUnitDTO {
  return {
    shelfId: row.shelfId,
    unitId: row.unitId,
    kind: row.kind as ShelfUnitKind,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function mapShelfUnitRelationToDTO(
  row: ShelfUnitRelationRow,
): ShelfUnitRelationDTO {
  return {
    shelfId: row.shelfId,
    parentUnitId: row.parentUnitId,
    childUnitId: row.childUnitId,
    role: row.role as ShelfUnitRelationRole,
  };
}

export function mapShelfToDTO(row: ShelfWithMetadata): ShelfDTO {
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: mapPublicUser(row.unit?.user),
    status: row.unit?.status,
    visibility: row.unit?.visibility,
    licenseSlug: resolveStoredLicenseSlug(row.unit?.licenseSlug),
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

export function mapShelfDetailToDTO(
  row: ShelfWithMetadata,
  itemCount: number,
): ShelfDetailDTO {
  return {
    ...mapShelfToDTO(row),
    itemCount,
    tags: row.unit?.unitTags
      ?.filter((t) => t.pinned)
      .map((t) => ({
        tagUnitId: t.tagUnitId,
        score: t.score,
      })),
  };
}

export function mapShelfListRowToDTO(row: ShelfListSelected): ShelfDTO {
  return {
    unitId: row.unitId,
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    user: mapPublicUser(row.unit?.user),
    status: row.unit?.status,
    visibility: row.unit?.visibility,
    licenseSlug: resolveStoredLicenseSlug(row.unit?.licenseSlug),
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
    slug: row.unit?.slug ?? undefined,
    userId: row.unit?.userId ?? undefined,
    kindKey: row.kindKey ?? undefined,
    coverUrl: pickShelfCoverUrl(
      row.unit?.defaultLanguage,
      row.unit?.translations,
    ),
    title,
    itemCount: row.itemCount,
    tags: row.unit?.unitTags
      ?.filter((t) => t.pinned)
      .map((t) => ({
        tagUnitId: t.tagUnitId,
        score: t.score,
      })),
  };
}
