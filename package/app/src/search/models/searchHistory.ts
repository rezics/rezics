/**
 * Local-only recent-search history. Persists submitted keyword strings in
 * `localStorage` so the search route can offer one-tap recall. There is no
 * server contract: this is a client convenience scoped to the browser.
 */

const STORAGE_KEY = "rezics:search-history";
const MAX_ENTRIES = 8;
const MAX_TERM_LENGTH = 120;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** Read recent searches, most-recent first. Tolerates malformed storage. */
export function readSearchHistory(): string[] {
  if (!hasStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((entry): entry is string => typeof entry === "string")
      .slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

function write(entries: string[]): string[] {
  if (!hasStorage()) return entries;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Quota or privacy mode — history is best-effort.
  }
  return entries;
}

/**
 * Record a submitted term. Trims, dedupes case-insensitively, moves an
 * existing match to the front, and caps the list. Empty terms are ignored
 * and the unchanged list is returned.
 */
export function pushSearchHistory(term: string): string[] {
  const trimmed = term.trim().slice(0, MAX_TERM_LENGTH);
  if (!trimmed) return readSearchHistory();
  const lower = trimmed.toLowerCase();
  const rest = readSearchHistory().filter(
    (entry) => entry.toLowerCase() !== lower,
  );
  return write([trimmed, ...rest].slice(0, MAX_ENTRIES));
}

/** Remove a single entry (case-insensitive match). */
export function removeSearchHistory(term: string): string[] {
  const lower = term.trim().toLowerCase();
  return write(
    readSearchHistory().filter((entry) => entry.toLowerCase() !== lower),
  );
}

/** Clear all recent searches. */
export function clearSearchHistory(): string[] {
  return write([]);
}
