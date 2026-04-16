import type { LinkDTO, UnitTranslationDTO } from "@rezics/contract";
import type { LinkWithRelations } from "./link.types";

export function mapLinkToDTO(row: LinkWithRelations): LinkDTO {
  return {
    unitId: row.unitId,
    url: row.url,
    siteName: row.siteName ?? undefined,
    faviconUrl: row.faviconUrl ?? undefined,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    translations: (row.unit?.translations ?? []) as unknown as UnitTranslationDTO[],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
