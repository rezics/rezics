import { useEffect, useState } from "react";

export type TagSuggestion = {
  slug: string;
  unitId?: string;
  name?: string;
};

// MOCK: static seed used until Meilisearch tag-index ships a slug-prefix
// endpoint. Replace with a debounced API call against the real tag index.
// MOCK：在 Meilisearch 标签索引提供 slug 前缀端点之前使用的静态种子数据。
// 待替换为针对真实标签索引的防抖 API 调用。
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
// MOCK：按 slug 前缀过滤种子列表。
function mockFilter(input: string): TagSuggestion[] {
  const q = input.toLowerCase();
  return MOCK_SLUGS.filter((s) => s.startsWith(q)).map((slug) => ({ slug }));
}

/**
 * TODO(meili-tag-index): Replace the MOCK below with a debounced call against
 * the Meilisearch tag index. Expected contract: `{ slug, unitId, name }` per
 * hit, slug-prefix match, 250 ms debounce, bounded result count (~20).
 * TODO(meili-tag-index)：将下方的 MOCK 替换为针对 Meilisearch 标签索引的防抖调用。
 * 预期契约：每条命中返回 `{ slug, unitId, name }`，按 slug 前缀匹配，250 毫秒防抖，
 * 结果数量受限（约 20 条）。
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
