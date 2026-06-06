import { useEffect, useState } from "react";

export type TagSuggestion = {
  slug: string;
  unitId?: string;
  name?: string;
};

// MOCK: static seed used until Meilisearch tag-index ships a slug-prefix
// endpoint. Replace with a debounced API call against the real tag index.
const MOCK_SLUGS = [
  "fiction",
  "nonfiction",
  "mystery",
  "romance",
  "history",
  "science",
  "fantasy",
  "philosophy",
  "light-novel",
  "isekai",
  "adventure",
  "thriller",
  "biography",
  "poetry",
  "comic",
  "manga",
  "webtoon",
  "classical",
  "translated",
  "children",
];

// MOCK: filter the seed list by slug-prefix
function mockFilter(input: string): TagSuggestion[] {
  const q = input.toLowerCase();
  return MOCK_SLUGS.filter((s) => s.startsWith(q)).map((slug) => ({ slug }));
}

/**
 * TODO(meili-tag-index): Replace the MOCK below with a debounced call against
 * the Meilisearch tag index. Expected contract: `{ slug, unitId, name }` per
 * hit, slug-prefix match, 250 ms debounce, bounded result count (~20).
 */
export function useTagSuggest(input: string): {
  suggestions: TagSuggestion[];
  loading: boolean;
} {
  const [debounced, setDebounced] = useState(input);

  useEffect(() => {
    const handle = setTimeout(() => setDebounced(input), 250);
    return () => clearTimeout(handle);
  }, [input]);

  const trimmed = debounced.trim();
  if (trimmed.length === 0) {
    return { suggestions: [], loading: false };
  }

  return { suggestions: mockFilter(trimmed), loading: false };
}
