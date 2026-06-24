import type {
  BookDTO,
  Language,
  SupportLanguageLike,
  UnitTranslationDTO,
} from "@rezics/contract";
import { readCoverUrlFromExtra, resolveReadLanguage } from "@rezics/contract";
import type { EffectiveReadLanguageInput } from "@/unit/language-resolution";
import { resolveStoredLicenseSlug } from "@/unit/publication-policy";
import { mapPublicUser } from "@/utils/sanitizeUser";
import type { BookWithRelations } from "./types";

function optionalCount(row: unknown, key: string): number | undefined {
  const value = (row as Record<string, unknown> | null | undefined)?.[key];
  return typeof value === "number" ? value : undefined;
}

function normalizeReadLanguageInput(
  readLanguage: EffectiveReadLanguageInput | readonly string[],
): EffectiveReadLanguageInput {
  return Array.isArray(readLanguage)
    ? { languages: readLanguage as readonly string[] }
    : (readLanguage as EffectiveReadLanguageInput);
}

function pickCoverUrl(
  book: BookWithRelations,
  resolvedLanguage?: string | null,
): string | undefined {
  const translations = book.unit.translations ?? [];
  if (translations.length === 0) return undefined;
  const defaultLang = book.unit.defaultLanguage;
  const ordered = [
    resolvedLanguage
      ? translations.find((t) => t.language === resolvedLanguage)
      : undefined,
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
 * 将 UnitTranslation 映射为 DTO（本地辅助函数）。
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
 * 将内部 Book 模型映射为 BookDTO（用于列表响应的基础版本）。
 */
export function mapBaseBookToDTO(
  book: BookWithRelations,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): BookDTO {
  const unit = book.unit;
  const readInput = normalizeReadLanguageInput(readLanguage);
  const resolvedLanguage = resolveReadLanguage({
    explicitLanguage: readInput.explicitLanguage,
    languages: readInput.languages,
    preferredLanguages: readInput.preferredLanguages,
    appLocale: readInput.appLocale,
    supportLanguages: unit.supportLanguages as SupportLanguageLike[],
  });
  const translation = resolvedLanguage
    ? unit.translations?.find((item) => item.language === resolvedLanguage)
    : undefined;

  return {
    unitId: book.unitId,
    userId: unit.userId,
    user: mapPublicUser(unit.user),
    status: unit.status,
    visibility: unit.visibility,
    rating: unit.rating,
    aiDisclosureMode: unit.aiDisclosureMode,
    aiDisclosureDetails:
      (unit.aiDisclosureDetails as BookDTO["aiDisclosureDetails"]) ?? undefined,
    licenseSlug: resolveStoredLicenseSlug(unit.licenseSlug),
    defaultLanguage: (unit.defaultLanguage as Language) ?? undefined,
    resolvedLanguage: resolvedLanguage as BookDTO["resolvedLanguage"],
    title: translation?.title ?? null,
    subtitle: translation?.subtitle ?? null,
    summary: translation?.summary ?? null,
    description:
      (translation?.description as BookDTO["description"] | undefined) ?? null,
    isLanguageNeutral: unit.isLanguageNeutral,
    catalogEntryKind: unit.catalogEntryKind,
    targetUnitId: unit.targetUnitId,
    referenceCount: unit.referenceCount,
    shareCount: optionalCount(unit, "shareCount"),

    // Book extension fields
    // Book 扩展字段。
    isbn13: book.isbn13 ?? undefined,
    publicationDate: book.publicationDate ?? undefined,
    pageCount: book.pageCount ?? undefined,
    textLength: book.textLength,
    chapterCount: book.chapterCount,
    formatKey: book.formatKey ?? undefined,
    isLicensed: book.isLicensed,
    coverUrl: pickCoverUrl(book, resolvedLanguage),
    extra: (book.extra as Record<string, unknown>) ?? undefined,

    // Translation layer
    // 翻译层。
    translations: unit.translations?.map(mapTranslation) ?? [],

    // Credit attribution
    // 署名归属。
    creditAttributions: (unit.creditAttributions?.map((a) => {
      const entityRecord = (a as any).entity ?? {};
      const innerEntity = entityRecord.entity ?? {};
      const entityTranslations = entityRecord.translations ?? [];
      const name = entityTranslations[0]?.title ?? "";
      return {
        entityId: a.entityId,
        name,
        role: a.role,
        position: a.position,
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
 * 将内部 Book 模型映射为 BookDTO（用于单条响应的完整版本）。
 */
export function mapBookToDTO(
  book: BookWithRelations,
  readLanguage: EffectiveReadLanguageInput | readonly string[] = {},
): BookDTO {
  return mapBaseBookToDTO(book, readLanguage);
}
