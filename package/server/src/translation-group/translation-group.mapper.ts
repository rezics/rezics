import type {
  TranslationGroupSibling,
  TranslationGroupSiblingDTO,
} from "./translation-group.types";
import { mainMarkdownSource } from "@rezics/contract";

const SNIPPET_MAX = 140;

export function mapSiblingToDTO(
  unit: TranslationGroupSibling,
): TranslationGroupSiblingDTO {
  const translationTitle = unit.translations.find(
    (t) => t.language === unit.defaultLanguage,
  )?.title;
  const contentText = mainMarkdownSource(unit.post?.content);
  const snippet =
    translationTitle ??
    (contentText ? contentText.slice(0, SNIPPET_MAX) : null);

  return {
    unitId: unit.id,
    defaultLanguage: unit.defaultLanguage ?? "",
    translationSnippet: snippet,
  };
}
