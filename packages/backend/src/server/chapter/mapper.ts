import type { ChapterDetailDTO, ChapterListItemDTO } from "@rezics/contract";
import { mainMarkdownSource, readCoverUrlFromExtra } from "@rezics/contract";
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

function pickContentTranslation(
  post: ChapterPostWithRelations,
): ChapterPostWithRelations["unit"]["contentTranslations"][number] | undefined {
  const translations = post.unit.contentTranslations ?? [];
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
  const contentTranslation = pickContentTranslation(post);
  return {
    unitId: post.unitId,
    title: translation?.title ?? "",
    noContent: !mainMarkdownSource(contentTranslation?.content)?.trim(),
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
  const contentTranslation = pickContentTranslation(post);
  return {
    unitId: post.unitId,
    title: translation?.title ?? "",
    content: contentTranslation?.content as ChapterDetailDTO["content"],
    userId: post.authorUserId,
    targetUnitId: post.unit.targetUnitId ?? null,
    coverUrl: readCoverUrlFromExtra(translation?.extra) ?? null,
    rating: post.unit.rating,
    aiDisclosureMode: post.unit.aiDisclosureMode,
    aiDisclosureDetails:
      (post.unit
        .aiDisclosureDetails as ChapterDetailDTO["aiDisclosureDetails"]) ??
      undefined,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}
