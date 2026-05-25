import type { UnitExternalRefDTO } from "@rezics/contract";
import { mapSourceSiteToDTO } from "@/source-site/source-site.mapper";
import type { UnitExternalRefWithRelations } from "./unit-external-ref.types";

export function mapUnitExternalRefToDTO(
  row: UnitExternalRefWithRelations,
): UnitExternalRefDTO {
  return {
    id: row.id,
    unitId: row.unitId,
    sourceSiteEntityUnitId: row.sourceSiteEntityUnitId,
    externalKind: row.externalKind as UnitExternalRefDTO["externalKind"],
    externalId: row.externalId,
    canonicalUrl: row.canonicalUrl,
    originalUrl: row.originalUrl ?? undefined,
    firstSeenAt: row.firstSeenAt,
    lastSeenAt: row.lastSeenAt,
    sourceSite: row.sourceSite
      ? mapSourceSiteToDTO(row.sourceSite as any)
      : undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
