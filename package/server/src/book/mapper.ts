import type { BookDTO, Language, UnitTranslationDTO } from "@rezics/contract";
import { readCoverUrlFromExtra } from "@rezics/contract";
import { resolveStoredLicenseSlug } from "@/unit/publication-policy";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { BookWithRelations } from "./types";

function pickCoverUrl(book: BookWithRelations): string | undefined {
  const translations = book.unit.translations ?? [];
  if (translations.length === 0) return undefined;
  const defaultLang = book.unit.defaultLanguage;
  const ordered = [
    defaultLang
      ? translations.find((t) => t.language === defaultLang)
      : undefined,
    translations.find((t) => t.language === "en"),
    ...translations,
  ];
  for (const tr of ordered) {
    const url = readCoverUrlFromExtra(tr?.extra);
    if (url) return url;
  }
  return undefined;
}

/**
 * Map UnitTranslation to DTO (local helper)
 */
function mapTranslation(
  tr: BookWithRelations["unit"]["translations"][number],
): UnitTranslationDTO {
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

/**
 * Map internal Book model to BookDTO (base version for list responses)
 */
export function mapBaseBookToDTO(book: BookWithRelations): BookDTO {
  const unit = book.unit;

  return {
    unitId: book.unitId,
    userId: unit.userId,
    user: mapPublicUser(unit.user),
    workUnitId: unit.workUnitId ?? undefined,
    status: unit.status,
    visibility: unit.visibility,
    rating: unit.rating,
    licenseSlug: resolveStoredLicenseSlug(unit.licenseSlug),
    defaultLanguage: (unit.defaultLanguage as Language) ?? undefined,
    isLanguageNeutral: unit.isLanguageNeutral,

    // Book extension fields
    isbn13: book.isbn13 ?? undefined,
    publicationDate: book.publicationDate ?? undefined,
    pageCount: book.pageCount ?? undefined,
    textLength: book.textLength,
    chapterCount: book.chapterCount,
    formatKey: book.formatKey ?? undefined,
    isLicensed: book.isLicensed,
    coverUrl: pickCoverUrl(book),
    extra: (book.extra as Record<string, unknown>) ?? undefined,

    // Translation layer
    translations: unit.translations?.map(mapTranslation) ?? [],

    // Credit attribution
    creditAttributions: (unit.creditAttributions?.map((a) => {
      const entityRecord = (a as any).entity ?? {};
      const innerEntity = entityRecord.entity ?? {};
      const entityTranslations = entityRecord.translations ?? [];
      const name = entityTranslations[0]?.title ?? "";
      return {
        entityId: a.entityId,
        name,
        role: a.role,
        sortOrder: a.sortOrder,
        entity: {
          unitId: innerEntity.unitId ?? a.entityId,
          kind: innerEntity.kind ?? undefined,
          avatar: innerEntity.avatar ?? undefined,
          slug: innerEntity.slug ?? undefined,
          translations: entityTranslations.map((tr: any) => ({
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
          })),
        },
      };
    }) ?? []) as BookDTO["creditAttributions"],

    createdAt: book.createdAt,
    updatedAt: book.updatedAt,
    publishedAt: unit.publishedAt ?? undefined,
  };
}

/**
 * Map internal Book model to BookDTO (full version for single-item responses)
 */
export function mapBookToDTO(book: BookWithRelations): BookDTO {
  return mapBaseBookToDTO(book);
}
