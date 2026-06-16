/**
 * Translation helpers for the new Unit/Book translation layer.
 * 新 Unit/Book 翻译层的翻译辅助函数。
 *
 * Ordinary read DTOs carry server-resolved display fields. Translation arrays
 * remain for explicit language switchers and edit surfaces.
 * 普通读取 DTO 携带服务端已解析的展示字段。翻译数组保留用于显式的语言切换器和编辑界面。
 */

import type {
  BookDTO,
  CreditAttributionEvidenceSummary,
  UnitTranslationDTO,
} from "@rezics/contract";
import { FALLBACK_LANGUAGE, mainMarkdownSource } from "@rezics/contract";

/**
 * Get the user's preferred languages from settings.
 * 从设置中获取用户的首选语言。
 * Returns empty array as placeholder — will be wired to the user settings API's
 * preferred language list.
 * 当前返回空数组作为占位 —— 将来会接入 user settings API 的首选语言列表。
 */
export function getUserPreferredLanguages(): string[] {
  return [];
}

/**
 * Resolve the best translation from a translations array.
 * 从翻译数组中解析出最佳翻译。
 * Resolution order: preferred → unit default → 'en' (platform fallback) → first available.
 * 解析顺序：首选 → unit 默认 → 'en'（平台回退）→ 第一个可用项。
 *
 * @param translations - Array of available translations。可用翻译的数组。
 * @param language - Preferred language code (highest priority)。首选语言代码（最高优先级）。
 * @param unitDefaultLanguage - Unit's default language (second priority)。Unit 的默认语言（次优先级）。
 * @param explicitLanguage - If provided, only return an exact match for this language (no fallback)。若提供，则仅返回该语言的精确匹配项（不回退）。
 */
export function getTranslation(
  translations: UnitTranslationDTO[] | undefined | null,
  language?: string,
  unitDefaultLanguage?: string,
  explicitLanguage?: string,
): UnitTranslationDTO | undefined {
  if (!translations || translations.length === 0) return undefined;

  // Explicit language: return exact match only, no fallback
  // 显式语言：仅返回精确匹配项，不进行回退
  if (explicitLanguage) {
    return translations.find((t) => t.language === explicitLanguage);
  }

  // 1. Exact match on preferred language
  // 1. 在首选语言上精确匹配
  if (language) {
    const exact = translations.find((t) => t.language === language);
    if (exact) return exact;
  }

  // 2. Fallback to unit's default language
  // 2. 回退到 unit 的默认语言
  if (unitDefaultLanguage) {
    const unitDefault = translations.find(
      (t) => t.language === unitDefaultLanguage,
    );
    if (unitDefault) return unitDefault;
  }

  // 3. Fallback to platform fallback language ('en')
  // 3. 回退到平台回退语言（'en'）
  const fallback = translations.find((t) => t.language === FALLBACK_LANGUAGE);
  if (fallback) return fallback;

  // 4. Last resort: first available entry
  // 4. 最后手段：第一个可用条目
  return translations[0];
}

/**
 * Extract title from a BookDTO's translations.
 * 从 BookDTO 的 translations 中提取标题。
 */
export function getBookTitle(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return "";
  if (!language) return book.title ?? "";
  const tr = getTranslation(
    book.translations,
    language,
    book.defaultLanguage ?? undefined,
  );
  return tr?.title ?? "";
}

/**
 * Extract description from a BookDTO's translations.
 * 从 BookDTO 的 translations 中提取描述。
 */
export function getBookDescription(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return "";
  if (!language) return mainMarkdownSource(book.description) ?? "";
  const tr = getTranslation(
    book.translations,
    language,
    book.defaultLanguage ?? undefined,
  );
  return mainMarkdownSource(tr?.description) ?? "";
}

/**
 * Extract summary from a BookDTO's translations.
 * 从 BookDTO 的 translations 中提取摘要。
 */
export function getBookSummary(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return "";
  if (!language) return book.summary ?? "";
  const tr = getTranslation(
    book.translations,
    language,
    book.defaultLanguage ?? undefined,
  );
  return tr?.summary ?? "";
}

/**
 * Extract subtitle from a BookDTO's translations.
 * 从 BookDTO 的 translations 中提取副标题。
 */
export function getBookSubtitle(
  book: BookDTO | null | undefined,
  language?: string,
): string {
  if (!book) return "";
  if (!language) return book.subtitle ?? "";
  const tr = getTranslation(
    book.translations,
    language,
    book.defaultLanguage ?? undefined,
  );
  return tr?.subtitle ?? "";
}

// Fallback cover placeholder image
// 封面占位图回退
const MOCK_COVER_PLACEHOLDER =
  "https://m.media-amazon.com/images/I/81wGzzxqHSL._SY466_.jpg";

/**
 * Resolve a cover URL from a BookDTO.
 * 从 BookDTO 中解析封面 URL。
 * Returns coverUrl directly when available; falls back to a MOCK placeholder.
 * 当 coverUrl 可用时直接返回；否则回退到 MOCK 占位图。
 */
export function getBookCoverUrl(book: BookDTO | null | undefined): string {
  if (!book) return MOCK_COVER_PLACEHOLDER;
  return book.coverUrl ?? MOCK_COVER_PLACEHOLDER;
}

/**
 * Filter credit attributions by role (e.g. 'author', 'translator', 'publisher').
 * 按角色（如 'author'、'translator'、'publisher'）筛选 credit attribution。
 */
export function getCreditAttributionsByRole(
  creditAttributions: BookDTO["creditAttributions"],
  role: string,
): NonNullable<BookDTO["creditAttributions"]> {
  if (!creditAttributions) return [];
  return creditAttributions.filter((a) => a.role === role);
}

export type EntityTranslation = {
  entityId: string;
  unitId: string;
  role: string;
  name: string;
  bio?: string;
  kind?: string | null;
  slug?: string | null;
  evidence?: CreditAttributionEvidenceSummary[];
};

/**
 * Resolve an entity's translated name/bio for a given language from a
 * book's credit attributions. The credit attribution brief carries an optional `entity`
 * with `translations[]` (UnitTranslationDTO). Falls back through the
 * standard translation chain when the requested language is unavailable.
 * 从一本书的 credit attribution 中解析某个 entity 在给定语言下的翻译 name/bio。
 * credit attribution 简要信息携带一个可选的 `entity`，其中带有 `translations[]`
 * （UnitTranslationDTO）。当请求的语言不可用时，沿标准翻译链回退。
 *
 * Always returns at least an entry with the credit attribution's denormalized
 * `name` so callers don't need to handle the missing-entity case.
 * 始终至少返回一个携带 credit attribution 反规范化 `name` 的条目，
 * 使调用方无需处理缺失 entity 的情况。
 */
export function getEntityTranslation(
  creditAttributions: BookDTO["creditAttributions"],
  role: string,
  language?: string,
): EntityTranslation | undefined {
  return getEntityTranslationsByRole(creditAttributions, role, language)[0];
}

export function getEntityTranslationsByRole(
  creditAttributions: BookDTO["creditAttributions"],
  role: string,
  language?: string,
): EntityTranslation[] {
  const matches = getCreditAttributionsByRole(creditAttributions, role);
  if (matches.length === 0) return [];

  return matches.map((match) => {
    const translations = match.entity?.translations as
      | UnitTranslationDTO[]
      | undefined;
    const tr = getTranslation(translations, language);
    return {
      entityId: match.entityId,
      unitId: match.entity?.unitId ?? match.entityId,
      role: match.role,
      name: tr?.title ?? match.name,
      bio: mainMarkdownSource(tr?.description) ?? undefined,
      kind: match.entity?.kind ?? undefined,
      slug: match.entity?.slug ?? undefined,
      evidence: match.evidence,
    };
  });
}

/**
 * Get the primary author name from a BookDTO.
 * 从 BookDTO 中获取主要作者名。
 * Returns the first credit attribution with role 'author', or the first credit attribution.
 * 返回第一个角色为 'author' 的 credit attribution，否则返回第一个 credit attribution。
 */
export function getBookAuthorName(book: BookDTO | null | undefined): string {
  if (!book?.creditAttributions?.length) return "";
  const authors = getCreditAttributionsByRole(
    book.creditAttributions,
    "author",
  );
  if (authors.length > 0) return authors[0].name;
  // Fallback to first credit attribution
  // 回退到第一个 credit attribution
  return book.creditAttributions[0].name;
}

/**
 * Get the primary publisher name from a BookDTO.
 * 从 BookDTO 中获取主要出版方名。
 */
export function getBookPublisherName(book: BookDTO | null | undefined): string {
  if (!book?.creditAttributions?.length) return "";
  const publishers = getCreditAttributionsByRole(
    book.creditAttributions,
    "publisher",
  );
  if (publishers.length > 0) return publishers[0].name;
  return "";
}
