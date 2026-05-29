import type { ShelfStreamEntry } from "./shelfStream";

/**
 * Whether a shelf entry is openable by the viewer under the readable filter.
 *
 * Only books are gated by `isLicensed`; non-book library kinds (`game`,
 * `media`) and non-library kinds (reviews, posts, tags, nested shelves) are
 * always kept, so the filter never hides anything other than unlicensed books.
 */
export function isReadableEntry(entry: ShelfStreamEntry): boolean {
  if (entry.unit.unit.kind !== "book") return true;
  const data = entry.unit.data as { isLicensed?: boolean } | undefined;
  return data?.isLicensed === true;
}

/**
 * Apply the readable filter to a shelf stream. When disabled the stream is
 * returned unchanged (copied); when enabled, unlicensed books are removed.
 */
export function filterReadableEntries(
  entries: readonly ShelfStreamEntry[],
  enabled: boolean,
): ShelfStreamEntry[] {
  if (!enabled) return [...entries];
  return entries.filter(isReadableEntry);
}
