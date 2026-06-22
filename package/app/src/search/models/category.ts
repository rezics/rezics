import { SEARCH_CATEGORIES, type SearchCategory } from "@rezics/contract";

// The category list comes straight from the contract (`SEARCH_CATEGORIES`),
// so this guard can never disagree with the canonical union.
// 分类列表直接来自契约（`SEARCH_CATEGORIES`），因此此守卫永远不会与规范
// union 不一致。
export function isSearchCategory(
  value: string | undefined,
): value is SearchCategory {
  return !!value && SEARCH_CATEGORIES.some((category) => category === value);
}
