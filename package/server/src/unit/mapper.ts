import type { UnitDTO, UnitTranslationDTO } from "@rezics/contract";
import { mapPublicUser } from "@/utils/sanitizeUser";
import { resolveStoredLicenseSlug } from "./publication-policy";
import type { UnitWithRelations } from "./types";

/**
 * Map internal Unit model to UnitDTO
 */
export function mapUnitToDTO(unit: UnitWithRelations): UnitDTO {
  return {
    id: unit.id,
    type: unit.type,
    slug: unit.slug ?? undefined,
    userId: unit.userId,
    user: mapPublicUser(unit.user),
    workUnitId: unit.workUnitId ?? undefined,
    defaultLanguage: unit.defaultLanguage ?? undefined,
    isLanguageNeutral: unit.isLanguageNeutral,
    translationGroupId: unit.translationGroupId ?? undefined,
    status: unit.status,
    visibility: unit.visibility,
    rating: unit.rating,
    licenseSlug: resolveStoredLicenseSlug(unit.licenseSlug),
    copyrightNotice: unit.copyrightNotice ?? undefined,
    extra: (unit.extra as Record<string, unknown>) ?? undefined,
    createdAt: unit.createdAt,
    updatedAt: unit.updatedAt,
    publishedAt: unit.publishedAt ?? undefined,
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
    description: translation.description ?? undefined,
    extra: (translation.extra as Record<string, unknown>) ?? undefined,
    sourceReleaseUnitId: translation.sourceReleaseUnitId ?? undefined,
    createdAt: translation.createdAt,
    updatedAt: translation.updatedAt,
  };
}
