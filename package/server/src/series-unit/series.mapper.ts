import type {
  Language,
  SeriesContentIndexDTO,
  SeriesDTO,
  SeriesKind,
  UnitTranslationDTO,
} from "@rezics/contract";
import { resolveStoredLicenseSlug } from "@/unit/publication-policy";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { SeriesContentIndex, UnitTranslation } from "../db/schema";
import type { SeriesWithRelations } from "./series.types";

type SeriesContentIndexRow = typeof SeriesContentIndex.$inferSelect;
type UnitTranslationRow = typeof UnitTranslation.$inferSelect;

function mapTranslation(tr: UnitTranslationRow): UnitTranslationDTO {
  return {
    unitId: tr.unitId,
    language: tr.language as Language,
    title: tr.title ?? undefined,
    subtitle: tr.subtitle ?? undefined,
    summary: tr.summary ?? undefined,
    description: tr.description as UnitTranslationDTO["description"],
    extra: (tr.extra as Record<string, unknown>) ?? undefined,
    sourceUnitId: tr.sourceUnitId ?? undefined,
    createdAt: tr.createdAt,
    updatedAt: tr.updatedAt,
  };
}

export function mapSeriesToDTO(series: SeriesWithRelations): SeriesDTO {
  const unit = series.unit;
  return {
    unitId: series.unitId,
    slug: unit.slug,
    userId: unit.userId,
    user: mapPublicUser(unit.user),
    kindKey: series.kindKey as SeriesKind,
    status: unit.status,
    visibility: unit.visibility,
    rating: unit.rating,
    defaultLanguage: (unit.defaultLanguage as Language) ?? undefined,
    isLanguageNeutral: unit.isLanguageNeutral,
    licenseSlug: resolveStoredLicenseSlug(unit.licenseSlug),
    extra: (series.extra as Record<string, unknown>) ?? undefined,
    translations: unit.translations?.map(mapTranslation) ?? [],
    createdAt: series.createdAt,
    updatedAt: series.updatedAt,
    publishedAt: unit.publishedAt ?? undefined,
  };
}

export function mapSeriesContentIndexToDTO(
  row: SeriesContentIndexRow,
): SeriesContentIndexDTO {
  return {
    seriesUnitId: row.seriesUnitId,
    releaseUnitId: row.releaseUnitId,
    contentNodeId: row.contentNodeId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
