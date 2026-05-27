import { userQueries } from "@rezics/api/user/user.queries";
import type { BookDTO } from "@rezics/contract";
import { FALLBACK_LANGUAGE } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";

import { bookLanguageAtom } from "../states/bookDetailAtoms";

/**
 * Resolve the initial language for a book detail page from the user's
 * ordered preference list, falling back to the unit's default language,
 * the platform fallback, then the first available translation.
 */
export function resolveInitialBookLanguage(
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
  preferredLanguages: readonly string[],
  bookInfo: BookDTO | null | undefined,
  stored: string | null | undefined,
): string {
  const available = availableBookLanguages(bookInfo);
  if (stored && (available.length === 0 || available.includes(stored))) {
    return stored;
  }
  return resolveInitialBookLanguage(preferredLanguages, bookInfo);
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
  const { data: settings } = useQuery({
    ...userQueries.settings(),
    // Anonymous users may 401; we'll fall through to defaults.
    retry: false,
  });

  const preferredLanguages = useMemo(
    () => settings?.preferredLanguages ?? [],
    [settings?.preferredLanguages],
  );

  const selectedLang = useMemo(
    () => resolveSelectedBookLanguage(preferredLanguages, bookInfo, stored),
    [preferredLanguages, bookInfo, stored],
  );

  const setSelectedLang = useCallback(
    (lang: string) => setStored(lang),
    [setStored],
  );

  return [selectedLang, setSelectedLang];
}
