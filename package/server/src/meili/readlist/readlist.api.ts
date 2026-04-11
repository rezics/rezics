// Readlist search — DEPRECATED: replaced by Shelf
// TODO(search-redesign): remove entirely when unified content index is implemented

import type { ReadlistSearchDocument, ReadlistSearchResult } from "@rezics/contract";

/** @deprecated No-op stub. Readlist search replaced by Shelf. */
export async function searchReadlistsRaw(
  _q: string,
  _options?: any,
): Promise<{ hits: ReadlistSearchDocument[]; totalHits: number; processingTimeMs: number; query: string }> {
  console.warn("[DEPRECATED] searchReadlistsRaw: readlist search removed, use shelf");
  return { hits: [], totalHits: 0, processingTimeMs: 0, query: _q };
}

/** @deprecated No-op stub. Readlist search replaced by Shelf. */
export async function searchReadlists(
  _opts: any,
): Promise<ReadlistSearchResult> {
  console.warn("[DEPRECATED] searchReadlists: readlist search removed, use shelf");
  return { readlists: [], total: 0, processingTimeMs: 0, query: "" };
}
