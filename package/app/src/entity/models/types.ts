import type { EntityDTO, UnitTranslationDTO } from "@rezics/contract";
import { getI18nRuntime } from "@rezics/i18n/runtime";
/**
 * Pure selectors for the Entity feature. No React, no hooks — safe to call
 * from any layer.
 */

export function getEntityTranslation(
  entity: Pick<EntityDTO, "translations"> | null | undefined,
  language: string | null | undefined,
): UnitTranslationDTO | undefined {
  if (!entity?.translations || entity.translations.length === 0)
    return undefined;
  if (language) {
    const exact = entity.translations.find((t) => t.language === language);
    if (exact) return exact;
  }
  return entity.translations[0];
}

export function getEntityPrimaryTitle(
  entity: Pick<EntityDTO, "translations"> | null | undefined,
  language?: string,
): string {
  const tr = getEntityTranslation(entity, language);
  return tr?.title?.trim() || getI18nRuntime().i18n.t("entity:untitled");
}

export function getEntityLanguages(
  entity: Pick<EntityDTO, "translations"> | null | undefined,
): string[] {
  if (!entity?.translations) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tr of entity.translations) {
    if (tr.language && !seen.has(tr.language)) {
      seen.add(tr.language);
      out.push(tr.language);
    }
  }
  return out;
}
