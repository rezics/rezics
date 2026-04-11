import type { UnitTagDTO } from "@rezics/contract";
import type { TagWithTranslations, UnitTagWithRelations } from "./types";

/**
 * Resolve a display label from a tag Unit's translations.
 * Picks the first translation that has a title, optionally preferring the given language.
 */
function resolveLabel(
  translations: TagWithTranslations["translations"],
  language?: string,
): string | undefined {
  if (!translations || translations.length === 0) return undefined;
  if (language) {
    const match = translations.find(
      (t) => t.language === language && t.title,
    );
    if (match?.title) return match.title;
  }
  return translations.find((t) => t.title)?.title ?? undefined;
}

/**
 * Map a UnitTag junction row (with relations) to the contract DTO.
 */
export function mapUnitTagToDTO(
  unitTag: UnitTagWithRelations,
  language?: string,
): UnitTagDTO {
  return {
    unitId: unitTag.unitId,
    tagUnitId: unitTag.tagUnitId,
    tagLabel: resolveLabel(unitTag.tag.translations, language),
    score: unitTag.score,
    voteCount: unitTag.voteCount,
    createdAt: unitTag.createdAt.toISOString(),
    updatedAt: unitTag.updatedAt.toISOString(),
  };
}

/**
 * Map a tag Unit (with translations) to a minimal DTO for listing.
 */
export function mapTagUnitToDTO(
  tag: TagWithTranslations,
  language?: string,
): {
  unitId: string;
  label: string | undefined;
  translations: { language: string; title: string | null }[];
} {
  return {
    unitId: tag.id,
    label: resolveLabel(tag.translations, language),
    translations: tag.translations.map((t) => ({
      language: t.language,
      title: t.title,
    })),
  };
}
