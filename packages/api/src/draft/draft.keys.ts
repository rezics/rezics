import type { DraftListQuery } from "@rezics/contract";

/**
 * Draft query keys. The root prefix is `["drafts"]` so the cache-coherence
 * map's `drafts` namespace reaches every draft query.
 */
export const draftKeys = {
  all: () => ["drafts"] as const,
  list: (query?: DraftListQuery) =>
    [...draftKeys.all(), "list", query ?? {}] as const,
} as const;
