import type { ShelfView } from "@rezics/api/shelf";

/**
 * Persisted shelf view-mode normalization is a clear cutover: recognized
 * current values survive, all legacy/unknown values resolve to nested and will
 * be overwritten on the next metadata save.
 * 持久化 shelf 视图模式采用清晰切换：当前值保留，所有旧值/未知值解析为
 * nested，并会在下次元数据保存时被覆盖。
 */
export function normalizeShelfViewMode(raw: unknown): ShelfView {
  if (raw === "flat" || raw === "nested" || raw === "bookshelf") {
    return raw;
  }
  return "nested";
}
