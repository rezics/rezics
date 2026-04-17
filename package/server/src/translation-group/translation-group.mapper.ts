import type {
  TranslationGroupSibling,
  TranslationGroupSiblingDTO,
} from "./translation-group.types";

const SNIPPET_MAX = 140;

export function mapSiblingToDTO(
  unit: TranslationGroupSibling,
): TranslationGroupSiblingDTO {
  const translationTitle = unit.translations.find(
    (t) => t.language === unit.defaultLanguage,
  )?.title;
  const body = unit.post?.body ?? null;
  const snippet =
    translationTitle ?? (body ? body.slice(0, SNIPPET_MAX) : null);

  return {
    unitId: unit.id,
    defaultLanguage: unit.defaultLanguage ?? "",
    translationSnippet: snippet,
  };
}
