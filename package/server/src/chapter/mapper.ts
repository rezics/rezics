import type { ChapterDetailDTO, ChapterListItemDTO } from "@rezics/contract";
import type { ChapterUnitWithRelations } from "./types";

export function mapUnitToChapterListItemDTO(
  u: ChapterUnitWithRelations,
): ChapterListItemDTO {
  const translation = u.translations?.[0];
  return {
    unitId: u.id,
    title: translation?.title ?? "",
    noContent: !translation?.description,
    userId: u.userId ?? undefined,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export function mapUnitToChapterDetailDTO(
  u: ChapterUnitWithRelations,
): ChapterDetailDTO {
  const translation = u.translations?.[0];
  return {
    unitId: u.id,
    title: translation?.title ?? "",
    content: translation?.description ?? undefined,
    userId: u.userId ?? undefined,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}
