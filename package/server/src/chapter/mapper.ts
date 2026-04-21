import type { ChapterDetailDTO, ChapterListItemDTO } from "@rezics/contract";
import { readCoverUrlFromExtra } from "@rezics/contract";
import type { ChapterPostWithRelations } from "./types";

function pickTranslation(
  post: ChapterPostWithRelations,
): ChapterPostWithRelations["unit"]["translations"][number] | undefined {
  const translations = post.unit.translations ?? [];
  if (translations.length === 0) return undefined;
  const defaultLang = post.unit.defaultLanguage;
  return (
    (defaultLang
      ? translations.find((t) => t.language === defaultLang)
      : undefined) ??
    translations.find((t) => t.language === "en") ??
    translations[0]
  );
}

export function mapChapterPostToListItemDTO(
  post: ChapterPostWithRelations,
): ChapterListItemDTO {
  const translation = pickTranslation(post);
  return {
    unitId: post.unitId,
    title: translation?.title ?? "",
    noContent: !post.body,
    userId: post.authorUserId,
    coverUrl: readCoverUrlFromExtra(translation?.extra) ?? null,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

export function mapChapterPostToDetailDTO(
  post: ChapterPostWithRelations,
): ChapterDetailDTO {
  const translation = pickTranslation(post);
  return {
    unitId: post.unitId,
    title: translation?.title ?? "",
    content: post.body ?? undefined,
    userId: post.authorUserId,
    targetUnitId: post.targetUnitId ?? null,
    coverUrl: readCoverUrlFromExtra(translation?.extra) ?? null,
    rating: post.unit.rating,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
