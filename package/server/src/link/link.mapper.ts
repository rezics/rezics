import type { LinkDTO } from "@rezics/contract";
import type { LinkWithRelations } from "./link.types";

export function mapLinkToDTO(row: LinkWithRelations): LinkDTO {
  return {
    unitId: row.unitId,
    url: row.url,
    siteName: row.siteName ?? undefined,
    faviconUrl: row.faviconUrl ?? undefined,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: row.unit?.translations ?? [],
    createdAt: row.createdAt?.toISOString?.() ?? (row.createdAt as any),
    updatedAt: row.updatedAt?.toISOString?.() ?? (row.updatedAt as any),
  };
}
