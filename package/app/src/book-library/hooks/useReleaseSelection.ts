import type { BookDTO } from "@rezics/contract";
import { useEffect, useRef, useState } from "react";

/**
 * Resolve the official release `unitId` for a given language from a book's
 * `translations[]`. The translation's `sourceUnitId` is the
 * translation-designated release.
 */
function getOfficialRelease(
  bookInfo: BookDTO | null | undefined,
  language: string,
): string | undefined {
  const translation = bookInfo?.translations?.find(
    (tr) => tr.language === language,
  );
  return translation?.sourceUnitId ?? undefined;
}

/**
 * Manage the selected release for the Content tab.
 *
 * - Initializes to the official release for the current language; falls
 *   back to the current book's `unitId` if no official is designated.
 * - Auto-switches whenever `selectedLang` changes.
 * - User selections are preserved until the language changes again.
 */
export function useReleaseSelection(
  bookInfo: BookDTO | null | undefined,
  selectedLang: string,
): [string, (releaseUnitId: string) => void] {
  const fallback = bookInfo?.unitId ?? "";
  const [selected, setSelected] = useState<string>(
    getOfficialRelease(bookInfo, selectedLang) ?? fallback,
  );

  const lastLang = useRef(selectedLang);
  useEffect(() => {
    if (lastLang.current === selectedLang) return;
    lastLang.current = selectedLang;
    const next = getOfficialRelease(bookInfo, selectedLang);
    if (next) setSelected(next);
  }, [selectedLang, bookInfo]);

  return [selected, setSelected];
}
