/**
 * Translation helpers for the new Unit/Book translation layer.
 *
 * BookDTO and UnitDTO no longer have top-level `title`, `description`, etc.
 * Text fields are stored in `translations[]` (UnitTranslationDTO).
 * These helpers resolve the best match for a given language.
 */

import type {
  BookDTO,
  UnitTranslationDTO,
} from '@rezics/contract';

// MOCK: default language fallback chain
const DEFAULT_LANGUAGE_CHAIN = ['zh-CN', 'zh', 'en', 'ja'] as const;

/**
 * Resolve the best translation from a translations array.
 * Falls back through the language chain, then to the first available entry.
 */
export function getTranslation(
  translations: UnitTranslationDTO[] | undefined | null,
  language?: string,
  fallbackChain: readonly string[] = DEFAULT_LANGUAGE_CHAIN,
): UnitTranslationDTO | undefined {
  if (!translations || translations.length === 0) return undefined;

  // Exact match
  if (language) {
    const exact = translations.find((t) => t.language === language);
    if (exact) return exact;
  }

  // Fallback chain
  for (const lang of fallbackChain) {
    const match = translations.find((t) => t.language === lang);
    if (match) return match;
  }

  // Last resort: first entry
  return translations[0];
}

/**
 * Extract title from a BookDTO's translations.
 */
export function getBookTitle(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return '';
  const tr = getTranslation(book.translations, language ?? book.defaultLanguage ?? undefined);
  return tr?.title ?? '';
}

/**
 * Extract description from a BookDTO's translations.
 */
export function getBookDescription(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return '';
  const tr = getTranslation(book.translations, language ?? book.defaultLanguage ?? undefined);
  return tr?.description ?? '';
}

/**
 * Extract summary from a BookDTO's translations.
 */
export function getBookSummary(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return '';
  const tr = getTranslation(book.translations, language ?? book.defaultLanguage ?? undefined);
  return tr?.summary ?? '';
}

/**
 * Extract subtitle from a BookDTO's translations.
 */
export function getBookSubtitle(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return '';
  const tr = getTranslation(book.translations, language ?? book.defaultLanguage ?? undefined);
  return tr?.subtitle ?? '';
}

// MOCK: fallback cover placeholder
const MOCK_COVER_PLACEHOLDER =
  'https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg';

/**
 * Resolve a cover URL from a BookDTO.
 * Returns coverUrl directly when available; falls back to a MOCK placeholder.
 */
export function getBookCoverUrl(
  book: BookDTO | null | undefined,
): string {
  if (!book) return MOCK_COVER_PLACEHOLDER;
  return book.coverUrl ?? MOCK_COVER_PLACEHOLDER;
}

/**
 * Filter person credits by role key (e.g. 'author', 'translator', 'illustrator').
 */
export function getPersonCredits(
  credits: BookDTO['personCredits'],
  roleKey: string,
): Array<{ personId: string; name: string; roleKey: string; sortOrder?: number }> {
  if (!credits) return [];
  return credits.filter((c) => c.roleKey === roleKey);
}

/**
 * Filter org credits by role key (e.g. 'publisher', 'producer').
 */
export function getOrgCredits(
  credits: BookDTO['orgCredits'],
  roleKey: string,
): Array<{ organizationId: string; name: string; roleKey: string; sortOrder?: number }> {
  if (!credits) return [];
  return credits.filter((c) => c.roleKey === roleKey);
}

/**
 * Get the primary author name from a BookDTO.
 * Returns the first personCredit with roleKey 'author', or the first personCredit.
 */
export function getBookAuthorName(book: BookDTO | null | undefined): string {
  if (!book?.personCredits?.length) return '';
  const authors = getPersonCredits(book.personCredits, 'author');
  if (authors.length > 0) return authors[0].name;
  // Fallback to first credit
  return book.personCredits[0].name;
}

/**
 * Get the primary publisher name from a BookDTO.
 */
export function getBookPublisherName(book: BookDTO | null | undefined): string {
  if (!book?.orgCredits?.length) return '';
  const publishers = getOrgCredits(book.orgCredits, 'publisher');
  if (publishers.length > 0) return publishers[0].name;
  return book.orgCredits[0].name;
}

/**
 * Get tag labels from scored tag briefs on a BookDTO.
 */
export function getBookTagLabels(
  book: BookDTO | null | undefined,
): Array<{ tagUnitId: string; label: string; score: number }> {
  if (!book?.tags) return [];
  return book.tags.map((t) => ({
    tagUnitId: t.tagUnitId,
    label: t.label ?? t.tagUnitId,
    score: t.score,
  }));
}
