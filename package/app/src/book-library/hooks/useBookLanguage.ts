import type { BookDTO } from "@rezics/contract";
import { userQueries } from "@rezics/api/user/user.queries";
import { useQuery } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { FALLBACK_LANGUAGE } from "@rezics/contract";

import { bookLanguageAtom } from "../state/bookDetailAtoms";

/**
 * Resolve the initial language for a book detail page from the user's
 * ordered preference list, falling back to the unit's default language,
 * the platform fallback, then the first available translation.
 */
function resolveInitialLanguage(
  preferredLanguages: readonly string[],
  bookInfo: BookDTO | null | undefined,
): string {
  const available: string[] = (bookInfo?.translations ?? [])
    .map((tr) => tr.language as unknown as string)
    .filter(Boolean);

  if (available.length === 0) {
    return (bookInfo?.defaultLanguage as unknown as string) ?? FALLBACK_LANGUAGE;
  }

  for (const lang of preferredLanguages) {
    if (available.includes(lang)) return lang;
  }

  const unitDefault = bookInfo?.defaultLanguage as unknown as string | undefined;
  if (unitDefault && available.includes(unitDefault)) {
    return unitDefault;
  }

  if (available.includes(FALLBACK_LANGUAGE)) return FALLBACK_LANGUAGE;

  return available[0]!;
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

  const resolved = useMemo(
    () => resolveInitialLanguage(preferredLanguages, bookInfo),
    [preferredLanguages, bookInfo],
  );

  const selectedLang = stored ?? resolved;

  const setSelectedLang = useCallback(
    (lang: string) => setStored(lang),
    [setStored],
  );

  return [selectedLang, setSelectedLang];
}
