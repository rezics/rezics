/**
 * Local-only recent-search history. Persists submitted keyword strings in
 * `localStorage` so the search route can offer one-tap recall. There is no
 * server contract: this is a client convenience scoped to the browser.
 * 仅本地的最近搜索历史。将提交过的关键词字符串持久化到 `localStorage`，
 * 以便搜索路由提供一键召回。不存在服务端契约：这是仅限浏览器的客户端便利功能。
 */

const STORAGE_KEY = "rezics:search-history";
const MAX_ENTRIES = 8;
const MAX_TERM_LENGTH = 120;

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

/** Read recent searches, most-recent first. Tolerates malformed storage. 读取最近搜索，最新在前。容忍格式错误的存储。 */
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
    // 配额超限或隐私模式 —— 历史记录尽力而为。
  }
  return entries;
}

/**
 * Record a submitted term. Trims, dedupes case-insensitively, moves an
 * existing match to the front, and caps the list. Empty terms are ignored
 * and the unchanged list is returned.
 * 记录一个提交的搜索词。会去除首尾空白、大小写不敏感地去重、将已存在的匹配项
 * 移到最前，并限制列表长度。空词会被忽略并返回未变的列表。
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

/** Remove a single entry (case-insensitive match). 移除单个条目（大小写不敏感匹配）。 */
export function removeSearchHistory(term: string): string[] {
  const lower = term.trim().toLowerCase();
  return write(
    readSearchHistory().filter((entry) => entry.toLowerCase() !== lower),
  );
}

export function clearSearchHistory(): string[] {
  return write([]);
}
