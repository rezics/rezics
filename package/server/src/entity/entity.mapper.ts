import type { EntityDTO, Language } from "@rezics/contract";
import type { EntityWithRelations } from "./entity.types";

/** Project a Prisma Entity + Unit + translations row into the public DTO. */
export function mapEntityToDTO(row: EntityWithRelations): EntityDTO {
  return {
    unitId: row.unitId,
    kind: row.kind ?? undefined,
    avatar: row.avatar ?? undefined,
    verified: row.verified,
    eligibleCreditRoles: row.eligibleCreditRoles,
    eligibleSubjectRoles: row.eligibleSubjectRoles,
    slug: row.unit.slug ?? undefined,
    ownerUnitId: row.unit.userId ?? undefined,
    translations: row.unit.translations?.map((tr) => ({
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
    })),
    createdAt:
      row.unit.createdAt?.toISOString?.() ?? (row.unit.createdAt as any),
    updatedAt:
      row.unit.updatedAt?.toISOString?.() ?? (row.unit.updatedAt as any),
  };
}
