import type { EntityDTO, Language, UnitTranslationDTO } from "@rezics/contract";
import type { EntityWithRelations } from "./entity.types";

/**
 * Project an Entity + Unit + translations row into the public DTO.
 * 将 Entity + Unit + translations 行投影为公开 DTO。
 */
export function mapEntityToDTO(row: EntityWithRelations): EntityDTO {
  return {
    unitId: row.unitId,
    kind: row.kind as EntityDTO["kind"],
    avatar: row.avatar ?? undefined,
    verified: row.verified,
    eligibleCreditRoles:
      row.eligibleCreditRoles as EntityDTO["eligibleCreditRoles"],
    eligibleSubjectRoles:
      row.eligibleSubjectRoles as EntityDTO["eligibleSubjectRoles"],
    slug: row.unit.slug ?? undefined,
    ownerUnitId: row.unit.userId ?? undefined,
    translations: row.unit.translations?.map((tr) => ({
      unitId: tr.unitId,
      language: tr.language as Language,
      title: tr.title ?? undefined,
      subtitle: tr.subtitle ?? undefined,
      summary: tr.summary ?? undefined,
      description: tr.description as UnitTranslationDTO["description"],
      extra: (tr.extra as Record<string, unknown>) ?? undefined,
      sourceUnitId: tr.sourceUnitId ?? undefined,
      createdAt: tr.createdAt,
      updatedAt: tr.updatedAt,
    })),
    createdAt:
      row.unit.createdAt?.toISOString?.() ?? (row.unit.createdAt as any),
    updatedAt:
      row.unit.updatedAt?.toISOString?.() ?? (row.unit.updatedAt as any),
  };
}
