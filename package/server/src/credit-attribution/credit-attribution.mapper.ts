import type {
  CreditAttributionDTO,
  CreditAttributionEvidenceSummary,
  CreditAttributionRole,
  EntityKind,
  Language,
  SubjectAttributionRole,
} from "@rezics/contract";
import { mapEntityToDTO } from "@/entity/entity.mapper";
import type { CreditAttributionWithRelations } from "./types";

export function mapCreditAttributionToDTO(
  row: CreditAttributionWithRelations,
): CreditAttributionDTO {
  const entityUnit = row.entity;
  const entityExt = (entityUnit as any).entity;

  const evidence = (row.evidence ?? []).map((item: any) => {
    const sourceRef = item.sourceRef;
    const sourceSite = sourceRef?.sourceSite;
    return {
      id: item.id,
      unitId: item.unitId,
      entityId: item.entityId,
      role: item.role as CreditAttributionRole,
      sourceRefId: item.sourceRefId,
      sourceSiteEntityUnitId: sourceRef.sourceSiteEntityUnitId,
      externalKind: sourceRef.externalKind,
      externalId: sourceRef.externalId,
      canonicalUrl: sourceRef.canonicalUrl,
      originalUrl: sourceRef.originalUrl ?? undefined,
      claimPath: item.claimPath ?? undefined,
      observedUrl: item.observedUrl ?? undefined,
      observedAt: item.observedAt,
      confidence: item.confidence ?? undefined,
      sourceSite: sourceSite
        ? {
            entityUnitId: sourceSite.entityUnitId,
            key: sourceSite.key,
            entity: sourceSite.entity
              ? mapEntityToDTO(sourceSite.entity as any)
              : undefined,
          }
        : undefined,
    } satisfies CreditAttributionEvidenceSummary;
  });

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
    evidence: evidence.length ? evidence : undefined,
  };
}
