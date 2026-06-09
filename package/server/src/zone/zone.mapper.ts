import {
  type Language,
  mainMarkdownSource,
  resolveReadLanguage,
  type ZoneDTO,
  type ZoneTranslation,
} from "@rezics/contract";
import type { ZoneWithRelations } from "./zone.service";

/**
 * Map Zone + Unit storage rows to ZoneDTO. `name`/`description` resolve via
 * the reader's language candidate chain; the full `translations` array rides
 * along for the manage profile editor.
 * 将 Zone + Unit 存储行映射为 ZoneDTO。`name`/`description` 通过读者的
 * 语言候选链解析；完整的 `translations` 数组随行返回，供管理页资料编辑器
 * 使用。
 */
export function mapZoneToDTO(
  zone: ZoneWithRelations,
  preferredLanguages: readonly string[] = [],
): ZoneDTO {
  const translations = zone.unit?.translations ?? [];
  const resolvedLanguage = resolveReadLanguage({
    languages: preferredLanguages,
    supportLanguages: zone.unit?.supportLanguages,
  });
  const translation =
    translations.find((tr) => tr.language === resolvedLanguage) ??
    translations[0];

  return {
    unitId: zone.unitId,
    ownerRealmUnitId: zone.ownerRealmUnitId,
    slug: zone.unit?.slug ?? "",
    name: translation?.title ?? "",
    description: mainMarkdownSource(translation?.description) ?? null,
    translations: translations.map(
      (tr): ZoneTranslation => ({
        language: tr.language as Language,
        title: tr.title ?? undefined,
        description: mainMarkdownSource(tr.description) ?? undefined,
      }),
    ),
    config: zone.config,
    startsAt: zone.startsAt?.toISOString() ?? null,
    endsAt: zone.endsAt?.toISOString() ?? null,
  };
}
