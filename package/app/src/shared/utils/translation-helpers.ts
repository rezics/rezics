/**
 * Translation helpers for the new Unit/Book translation layer.
 *
 * BookDTO and UnitDTO no longer have top-level `title`, `description`, etc.
 * Text fields are stored in `translations[]` (UnitTranslationDTO).
 * These helpers resolve the best match for a given language.
 */

import type { BookDTO, UnitTranslationDTO } from "@rezics/contract";
import { FALLBACK_LANGUAGE } from "@rezics/contract";

/**
 * Get the user's preferred languages from settings.
 * Returns empty array as placeholder — will be wired to User.settings.preferredLanguages.
 */
export function getUserPreferredLanguages(): string[] {
  return [];
}

/**
 * Resolve the best translation from a translations array.
 * Resolution order: preferred → unit default → 'en' (platform fallback) → first available.
 *
 * @param translations - Array of available translations
 * @param language - Preferred language code (highest priority)
 * @param unitDefaultLanguage - Unit's default language (second priority)
 * @param explicitLanguage - If provided, only return an exact match for this language (no fallback)
 */
export function getTranslation(
  translations: UnitTranslationDTO[] | undefined | null,
  language?: string,
  unitDefaultLanguage?: string,
  explicitLanguage?: string,
): UnitTranslationDTO | undefined {
  if (!translations || translations.length === 0) return undefined;

  // Explicit language: return exact match only, no fallback
  if (explicitLanguage) {
    return translations.find((t) => t.language === explicitLanguage);
  }

  // 1. Exact match on preferred language
  if (language) {
    const exact = translations.find((t) => t.language === language);
    if (exact) return exact;
  }

  // 2. Fallback to unit's default language
  if (unitDefaultLanguage) {
    const unitDefault = translations.find(
      (t) => t.language === unitDefaultLanguage,
    );
    if (unitDefault) return unitDefault;
  }

  // 3. Fallback to platform fallback language ('en')
  const fallback = translations.find((t) => t.language === FALLBACK_LANGUAGE);
  if (fallback) return fallback;

  // 4. Last resort: first available entry
  return translations[0];
}

/**
 * Extract title from a BookDTO's translations.
 */
export function getBookTitle(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return "";
  const tr = getTranslation(
    book.translations,
    language ?? book.defaultLanguage ?? undefined,
  );
  return tr?.title ?? "";
}

/**
 * Extract description from a BookDTO's translations.
 */
export function getBookDescription(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return "";
  const tr = getTranslation(
    book.translations,
    language ?? book.defaultLanguage ?? undefined,
  );
  return tr?.description ?? "";
}

/**
 * Extract summary from a BookDTO's translations.
 */
export function getBookSummary(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return "";
  const tr = getTranslation(
    book.translations,
    language ?? book.defaultLanguage ?? undefined,
  );
  return tr?.summary ?? "";
}

/**
 * Extract subtitle from a BookDTO's translations.
 */
export function getBookSubtitle(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return "";
  const tr = getTranslation(
    book.translations,
    language ?? book.defaultLanguage ?? undefined,
  );
  return tr?.subtitle ?? "";
}

// Fallback cover placeholder image
const MOCK_COVER_PLACEHOLDER =
  "https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg";

/**
 * Resolve a cover URL from a BookDTO.
 * Returns coverUrl directly when available; falls back to a MOCK placeholder.
 */
export function getBookCoverUrl(book: BookDTO | null | undefined): string {
  if (!book) return MOCK_COVER_PLACEHOLDER;
  return book.coverUrl ?? MOCK_COVER_PLACEHOLDER;
}

/**
 * Filter attributions by role (e.g. 'author', 'translator', 'publisher').
 */
export function getAttributionsByRole(
  attributions: BookDTO["attributions"],
  role: string,
): Array<{ entityId: string; name: string; role: string; sortOrder?: number }> {
  if (!attributions) return [];
  return attributions.filter((a) => a.role === role);
}

export type EntityTranslation = {
  name: string;
  bio?: string;
};

/**
 * Resolve an entity's translated name/bio for a given language from a
 * book's attributions. The attribution brief carries an optional `entity`
 * with `translations[]` (UnitTranslationDTO). Falls back through the
 * standard translation chain when the requested language is unavailable.
 *
 * Always returns at least an entry with the attribution's denormalized
 * `name` so callers don't need to handle the missing-entity case.
 */
export function getEntityTranslation(
  attributions: BookDTO["attributions"],
  role: string,
  language?: string,
): EntityTranslation | undefined {
  const matches = getAttributionsByRole(attributions, role);
  if (matches.length === 0) return undefined;

  const first = matches[0] as (typeof matches)[number] & {
    entity?: {
      translations?: UnitTranslationDTO[];
    };
  };
  const translations = first.entity?.translations;
  const tr = getTranslation(translations, language);

  return {
    name: tr?.title ?? first.name,
    bio: tr?.description ?? undefined,
  };
}

/**
 * Get the primary author name from a BookDTO.
 * Returns the first attribution with role 'author', or the first attribution.
 */
export function getBookAuthorName(book: BookDTO | null | undefined): string {
  if (!book?.attributions?.length) return "";
  const authors = getAttributionsByRole(book.attributions, "author");
  if (authors.length > 0) return authors[0].name;
  // Fallback to first attribution
  return book.attributions[0].name;
}

/**
 * Get the primary publisher name from a BookDTO.
 */
export function getBookPublisherName(book: BookDTO | null | undefined): string {
  if (!book?.attributions?.length) return "";
  const publishers = getAttributionsByRole(book.attributions, "publisher");
  if (publishers.length > 0) return publishers[0].name;
  return "";
}
