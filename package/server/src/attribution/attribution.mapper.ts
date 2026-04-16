import type {
  AttributionDTO,
  EntityDTO,
} from "@rezics/contract";
import type { Language } from "@rezics/contract";
import type {
  AttributionWithRelations,
  EntityWithRelations,
} from "./types";

export function mapEntityToDTO(row: EntityWithRelations): EntityDTO {
  return {
    unitId: row.unitId,
    kind: row.kind ?? undefined,
    verified: row.verified,
    slug: row.unit.slug ?? undefined,
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
    createdAt: row.unit.createdAt?.toISOString?.() ?? (row.unit.createdAt as any),
    updatedAt: row.unit.updatedAt?.toISOString?.() ?? (row.unit.updatedAt as any),
  };
}

export function mapAttributionToDTO(
  row: AttributionWithRelations,
): AttributionDTO {
  const entityUnit = row.entity;
  const entityExt = (entityUnit as any).entity;

  return {
    unitId: row.unitId,
    entityId: row.entityId,
    role: row.role,
    sortOrder: row.sortOrder,
    entity: entityUnit
      ? {
          unitId: entityUnit.id,
          kind: entityExt?.kind ?? undefined,
          verified: entityExt?.verified ?? false,
          slug: entityUnit.slug ?? undefined,
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
          createdAt: entityUnit.createdAt?.toISOString?.() ?? (entityUnit.createdAt as any),
          updatedAt: entityUnit.updatedAt?.toISOString?.() ?? (entityUnit.updatedAt as any),
        }
      : undefined,
  };
}
