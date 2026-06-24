import type {
  CreditAttributionDTO,
  CreditAttributionEvidenceSummary,
  CreditAttributionRole,
  EntityKind,
  Language,
  SubjectAttributionRole,
} from "@rezics/contract";
import { mapEntityToDTO } from "../entity/entity.mapper";
import type { CreditAttributionWithRelations } from "./types";

export function mapCreditAttributionToDTO(
  row: CreditAttributionWithRelations,
): CreditAttributionDTO {
  const entityUnit = row.entity;
  const entityExt = (entityUnit as any).entity;

  const evidence = (row.evidence ?? []).map((item: any) => {
    const sourceExternalLink = item.sourceExternalLink;
    if (!sourceExternalLink) {
      throw new Error(
        "CreditAttribution evidence source link hydration failed",
      );
    }
    return {
      id: item.id,
      unitId: item.unitId,
      entityId: item.entityId,
      role: item.role as CreditAttributionRole,
      sourceExternalLinkId: item.sourceExternalLinkId,
      url: sourceExternalLink.url,
      claimPath: item.claimPath ?? undefined,
      observedUrl: item.observedUrl ?? undefined,
      observedAt: item.observedAt,
      confidence: item.confidence ?? undefined,
      sourceExternalLink: sourceExternalLink
        ? {
            id: sourceExternalLink.id,
            unitId: sourceExternalLink.unitId,
            sourceEntityUnitId: sourceExternalLink.sourceEntityUnitId,
            url: sourceExternalLink.url,
            normalizedUrl: sourceExternalLink.normalizedUrl ?? undefined,
            role: sourceExternalLink.role,
            sourceEntity: sourceExternalLink.sourceEntity
              ? mapEntityToDTO(sourceExternalLink.sourceEntity as any)
              : undefined,
          }
        : undefined,
    } satisfies CreditAttributionEvidenceSummary;
  });

  return {
    unitId: row.unitId,
    entityId: row.entityId,
    role: row.role as CreditAttributionRole,
    position: row.position,
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
            sourceUnitId: tr.sourceUnitId ?? undefined,
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
