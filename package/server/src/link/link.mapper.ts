import type { LinkDTO } from "@rezics/contract";
import { mapTranslationToDTO } from "@/unit/mapper";
import type { LinkWithRelations } from "./link.types";

export function mapLinkToDTO(row: LinkWithRelations): LinkDTO {
  return {
    unitId: row.unitId,
    url: row.url,
    siteName: row.siteName ?? undefined,
    faviconUrl: row.faviconUrl ?? undefined,
    extra: (row.extra as Record<string, unknown>) ?? undefined,
    // Run rows through the canonical mapper instead of casting raw DB rows —
    // it normalizes null→undefined and drops internal columns.
    // 让行经过规范 mapper，而非强转原始 DB 行——它把 null 规范为 undefined
    // 并丢弃内部列。
    translations: (row.unit?.translations ?? []).map(mapTranslationToDTO),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
