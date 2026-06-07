import type {
  SupportLanguageLike,
  UnitDTO,
  UnitTranslationDTO,
} from "@rezics/contract";
import { resolveReadLanguage } from "@rezics/contract";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { EffectiveReadLanguageInput } from "./language-resolution";
import { resolveStoredLicenseSlug } from "./publication-policy";
import type { UnitWithRelations } from "./types";

function optionalCount(row: unknown, key: string): number | undefined {
  const value = (row as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "number" ? value : undefined;
}

/**
 * Map internal Unit model to UnitDTO
 */
export function mapUnitToDTO(
  unit: UnitWithRelations,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): UnitDTO {
  const readInput = Array.isArray(readLanguage)
    ? { languages: readLanguage }
    : readLanguage;
  const resolvedLanguage = resolveReadLanguage({
    explicitLanguage: readInput.explicitLanguage,
    languages: readInput.languages,
    preferredLanguages: readInput.preferredLanguages,
    appLocale: readInput.appLocale,
    supportLanguages: unit.supportLanguages as SupportLanguageLike[],
  });
  const translation = resolvedLanguage
    ? unit.translations?.find((item) => item.language === resolvedLanguage)
    : undefined;

  return {
    id: unit.id,
    type: unit.type,
    slug: unit.slug ?? undefined,
    userId: unit.userId,
    user: mapPublicUser(unit.user),
    isLanguageNeutral: unit.isLanguageNeutral,
    status: unit.status,
    visibility: unit.visibility,
    rating: unit.rating,
    aiDisclosureMode: unit.aiDisclosureMode,
    aiDisclosureDetails:
      (unit.aiDisclosureDetails as UnitDTO["aiDisclosureDetails"]) ?? undefined,
    licenseSlug: resolveStoredLicenseSlug(unit.licenseSlug),
    extra: (unit.extra as Record<string, unknown>) ?? undefined,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    publishedAt: unit.publishedAt ?? undefined,
    referenceCount: unit.referenceCount,
    shareCount: optionalCount(unit, "shareCount"),
    resolvedLanguage: resolvedLanguage as UnitDTO["resolvedLanguage"],
    title: translation?.title ?? null,
    subtitle: translation?.subtitle ?? null,
    summary: translation?.summary ?? null,
    description:
      (translation?.description as UnitDTO["description"] | undefined) ?? null,
    translations: unit.translations?.map(mapTranslationToDTO) ?? [],
    supportLanguages:
      unit.supportLanguages?.map((sl) => ({
        unitId: sl.unitId,
        language: sl.language,
        isPrimary: sl.isPrimary,
        sortOrder: sl.sortOrder,
      })) ?? [],
  } as UnitDTO;
}

/**
 * Map a Unit list row to the resolved preview payload.
 *
 * List reads resolve against UnitSupportLanguage and intentionally do not
 * include every translation/support-language row. Missing fields in the
 * resolved language stay null rather than falling through to another language.
 */
export function mapUnitListItemToDTO(
  unit: UnitWithRelations,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): UnitDTO {
  const readInput = Array.isArray(readLanguage)
    ? { languages: readLanguage }
    : readLanguage;
  const resolvedLanguage = resolveReadLanguage({
    explicitLanguage: readInput.explicitLanguage,
    languages: readInput.languages,
    preferredLanguages: readInput.preferredLanguages,
    appLocale: readInput.appLocale,
    supportLanguages: unit.supportLanguages as SupportLanguageLike[],
  });
  const translation = resolvedLanguage
    ? unit.translations?.find((item) => item.language === resolvedLanguage)
    : undefined;

  return {
    id: unit.id,
    type: unit.type,
    slug: unit.slug ?? undefined,
    userId: unit.userId,
    user: mapPublicUser(unit.user),
    isLanguageNeutral: unit.isLanguageNeutral,
    status: unit.status,
    visibility: unit.visibility,
    rating: unit.rating,
    aiDisclosureMode: unit.aiDisclosureMode,
    aiDisclosureDetails:
      (unit.aiDisclosureDetails as UnitDTO["aiDisclosureDetails"]) ?? undefined,
    licenseSlug: resolveStoredLicenseSlug(unit.licenseSlug),
    extra: (unit.extra as Record<string, unknown>) ?? undefined,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    publishedAt: unit.publishedAt ?? undefined,
    referenceCount: unit.referenceCount,
    shareCount: optionalCount(unit, "shareCount"),
    resolvedLanguage: resolvedLanguage as UnitDTO["resolvedLanguage"],
    title: translation?.title ?? null,
    subtitle: translation?.subtitle ?? null,
    summary: translation?.summary ?? null,
    description:
      (translation?.description as UnitDTO["description"] | undefined) ?? null,
  } as UnitDTO;
}

/**
 * Map UnitTranslation row to DTO
 */
export function mapTranslationToDTO(
  translation: UnitWithRelations["translations"][number],
): UnitTranslationDTO {
  return {
    unitId: translation.unitId,
    language: translation.language as UnitTranslationDTO["language"],
    title: translation.title ?? undefined,
    subtitle: translation.subtitle ?? undefined,
    summary: translation.summary ?? undefined,
    description: translation.description as UnitTranslationDTO["description"],
    extra: (translation.extra as Record<string, unknown>) ?? undefined,
    sourceUnitId: translation.sourceUnitId ?? undefined,
    createdAt: translation.createdAt,
    updatedAt: translation.updatedAt,
  };
}
