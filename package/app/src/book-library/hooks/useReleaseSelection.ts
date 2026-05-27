import type { BookDTO } from "@rezics/contract";
import { useEffect, useState } from "react";

/**
 * Manage the selected release for the Content tab.
 *
 * - Initializes to the current visible release's `unitId`.
 * - Keeps language switching scoped to the current release; users switch
 *   releases explicitly through the release selector.
 * - Resets when route navigation changes the active book release.
 */
export function useReleaseSelection(
  bookInfo: BookDTO | null | undefined,
  _selectedLang: string,
): [string, (releaseUnitId: string) => void] {
  const fallback = bookInfo?.unitId ?? "";
  const [selected, setSelected] = useState<string>(fallback);

  useEffect(() => {
    if (fallback) setSelected(fallback);
  }, [fallback]);

  return [selected, setSelected];
}
