import type {
  CreditAttributionDTO,
  CreditAttributionRole,
  EntityKind,
  Language,
  SubjectAttributionRole,
} from "@rezics/contract";
import type { CreditAttributionWithRelations } from "./types";

export function mapCreditAttributionToDTO(
  row: CreditAttributionWithRelations,
): CreditAttributionDTO {
  const entityUnit = row.entity;
  const entityExt = (entityUnit as any).entity;

  return {
    unitId: row.unitId,
    entityId: row.entityId,
    role: row.role as CreditAttributionRole,
    sortOrder: row.sortOrder,
    entity: entityUnit
      ? {
          unitId: entityUnit.id,
          kind: (entityExt?.kind as EntityKind | null | undefined) ?? undefined,
          avatar: entityExt?.avatar ?? undefined,
          verified: entityExt?.verified ?? false,
          eligibleCreditRoles: (entityExt?.eligibleCreditRoles ??
            []) as CreditAttributionRole[],
          eligibleSubjectRoles: (entityExt?.eligibleSubjectRoles ??
            []) as SubjectAttributionRole[],
          slug: entityUnit.slug ?? undefined,
          ownerUnitId: entityUnit.userId ?? undefined,
          translations: (entityUnit as any).translations?.map((tr: any) => ({
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
            entityUnit.createdAt?.toISOString?.() ??
            (entityUnit.createdAt as any),
          updatedAt:
            entityUnit.updatedAt?.toISOString?.() ??
            (entityUnit.updatedAt as any),
        }
      : undefined,
  };
}
