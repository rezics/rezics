import type { Language, SubjectAttributionDTO } from "@rezics/contract";
import type { SubjectAttributionWithRelations } from "./types";

function mapTranslations(translations: any[] | undefined) {
  return translations?.map((tr: any) => ({
    unitId: tr.unitId,
    language: tr.language as Language,
    title: tr.title ?? undefined,
    subtitle: tr.subtitle ?? undefined,
    summary: tr.summary ?? undefined,
    description: tr.description ?? undefined,
    extra: (tr.extra as Record<string, unknown>) ?? undefined,
    sourceReleaseUnitId: tr.sourceReleaseUnitId ?? undefined,
    createdAt: tr.createdAt,
    updatedAt: tr.updatedAt,
  }));
}

export function mapSubjectAttributionToDTO(
  row: SubjectAttributionWithRelations,
): SubjectAttributionDTO {
  const entityUnit = row.entity;
  const entityExt = (entityUnit as any).entity;
  const unit = (row as any).unit;

  return {
    unitId: row.unitId,
    entityId: row.entityId,
    role: row.role,
    sortOrder: row.sortOrder,
    weight: row.weight ?? undefined,
    entity: entityUnit
      ? {
          unitId: entityUnit.id,
          kind: entityExt?.kind ?? undefined,
          verified: entityExt?.verified ?? false,
          slug: entityUnit.slug ?? undefined,
          ownerUnitId: entityUnit.userId ?? undefined,
          translations: mapTranslations((entityUnit as any).translations),
          createdAt:
            entityUnit.createdAt?.toISOString?.() ??
            (entityUnit.createdAt as any),
          updatedAt:
            entityUnit.updatedAt?.toISOString?.() ??
            (entityUnit.updatedAt as any),
        }
      : undefined,
    unit: unit
      ? {
          id: unit.id,
          type: unit.type,
          slug: unit.slug ?? undefined,
          userId: unit.userId ?? undefined,
          workUnitId: unit.workUnitId ?? undefined,
          defaultLanguage: unit.defaultLanguage ?? undefined,
          isLanguageNeutral: unit.isLanguageNeutral ?? undefined,
          translationGroupId: unit.translationGroupId ?? undefined,
          status: unit.status ?? undefined,
          visibility: unit.visibility ?? undefined,
          rating: unit.rating ?? undefined,
          extra: (unit.extra as Record<string, unknown>) ?? undefined,
          createdAt: unit.createdAt,
          updatedAt: unit.updatedAt,
          publishedAt: unit.publishedAt ?? undefined,
          translations: mapTranslations(unit.translations),
          supportLanguages: unit.supportLanguages?.map((language: any) => ({
            unitId: language.unitId,
            language: language.language as Language,
            isPrimary: language.isPrimary,
            sortOrder: language.sortOrder,
          })),
        }
      : undefined,
  };
}
