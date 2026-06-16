import {
  mainMarkdownSource,
  type WikiZoneConfig,
  type ZoneDTO,
  type ZoneFilters,
} from "@rezics/contract";
import type { ZoneWithRelations } from "./zone.service";

/**
 * Map Zone + Unit storage rows to ZoneDTO.
 * Resolves translations using the first available translation.
 * 将 Zone + Unit 存储行映射为 ZoneDTO。
 * 使用第一个可用的翻译来解析翻译内容。
 */
export function mapZoneToDTO(zone: ZoneWithRelations, lang?: string): ZoneDTO {
  const translations = zone.unit?.translations ?? [];

  // Pick best translation: requested lang > first available
  // 选择最佳翻译：优先请求的 lang，其次第一个可用项。
  const translation =
    (lang ? translations.find((t) => t.language === lang) : undefined) ??
    translations[0];

  return {
    unitId: zone.unitId,
    slug: zone.unit?.slug ?? "",
    name: translation?.title ?? "",
    description: mainMarkdownSource(translation?.description) ?? null,
    filters: zone.filters as ZoneFilters,
    template: zone.template,
    styling: (zone.styling as Record<string, unknown>) ?? null,
    wiki: (zone.wiki as WikiZoneConfig | null) ?? null,
    startsAt: zone.startsAt?.toISOString() ?? null,
    endsAt: zone.endsAt?.toISOString() ?? null,
  };
}
