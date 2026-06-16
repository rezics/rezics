import type { BookDTO } from "@rezics/contract";
import { FALLBACK_LANGUAGE } from "@rezics/contract";
import { useAtom } from "jotai";
import { useMemo } from "react";
import { useReadLanguageContext } from "@/shared/hooks/useReadLanguageCandidates";

import { bookLanguageAtom } from "../states/bookDetailAtoms";

/**
 * Resolve the initial language for a book detail page from the app locale,
 * then the user's ordered preference list, falling back to the unit's default
 * language, the platform fallback, then the first available translation.
 */
export function resolveInitialBookLanguage(
  appLocale: string | null | undefined,
  preferredLanguages: readonly string[],
  bookInfo: BookDTO | null | undefined,
): string {
  const available: string[] = (bookInfo?.translations ?? [])
    .map((tr) => tr.language as unknown as string)
    .filter(Boolean);

  if (available.length === 0) {
    return (
      (bookInfo?.defaultLanguage as unknown as string) ?? FALLBACK_LANGUAGE
    );
  }

  if (appLocale && available.includes(appLocale)) return appLocale;

  for (const lang of preferredLanguages) {
    if (available.includes(lang)) return lang;
  }

  const unitDefault = bookInfo?.defaultLanguage as unknown as
    | string
    | undefined;
  if (unitDefault && available.includes(unitDefault)) {
    return unitDefault;
  }

  if (available.includes(FALLBACK_LANGUAGE)) return FALLBACK_LANGUAGE;

  return available[0]!;
}

function availableBookLanguages(
  bookInfo: BookDTO | null | undefined,
): string[] {
  return (bookInfo?.translations ?? [])
    .map((tr) => tr.language as unknown as string)
    .filter(Boolean);
}

export function resolveSelectedBookLanguage(
  appLocale: string | null | undefined,
  preferredLanguages: readonly string[],
  bookInfo: BookDTO | null | undefined,
  stored: string | null | undefined,
): string {
  const available = availableBookLanguages(bookInfo);
  if (stored && (available.length === 0 || available.includes(stored))) {
    return stored;
  }
  return resolveInitialBookLanguage(appLocale, preferredLanguages, bookInfo);
}

/**
 * Per-book language selection.
 *
 * Returns `[selectedLang, setSelectedLang]` where `selectedLang` is the
 * resolved current language (preference-resolved on first read), and
 * `setSelectedLang` updates the per-book atom.
 *
 * Selection is ephemeral — it is not persisted across navigations away
 * from the book detail page.
 */
export function useBookLanguage(
  bookId: string,
  bookInfo: BookDTO | null | undefined,
): [string, (lang: string) => void] {
  const [stored, setStored] = useAtom(bookLanguageAtom(bookId));
  const readContext = useReadLanguageContext();

  const selectedLang = useMemo(
    () =>
      resolveSelectedBookLanguage(
        readContext.appLocale,
        readContext.languages,
        bookInfo,
        stored,
      ),
    [readContext.appLocale, readContext.languages, bookInfo, stored],
  );

  const setSelectedLang = (lang: string) => setStored(lang);

  return [selectedLang, setSelectedLang];
}
