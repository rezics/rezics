import type {
  FederatedSearchResult,
  SearchCategory,
  SearchQuery,
  SearchScope,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useEffect, useMemo } from "react";
import { useLocalizedFederatedSearch } from "@/shared/hooks/useLocalizedMeiliSearch";
import {
  AdvancedSearch,
  FederatedResultList,
  SearchCategoryNav,
  SearchHistory,
} from "../components";
import { AppliedFilterChips } from "../components/primitive";
import { useInjectedTags } from "../hooks/useInjectedTags";
import { useSearchHistory } from "../hooks/useSearchHistory";
import { useSearchQuery } from "../hooks/useSearchQuery";
import { parseSearchString } from "../models/searchQuery";

export { isSearchCategory } from "../models/category";

export type FederatedSearchPageProps = {
  scope: SearchScope;
  initialQuery?: SearchQuery;
  implicitInitial?: SearchQuery;
  initialCategory?: SearchCategory;
  onCategoryChange: (next: SearchCategory) => void;
  /**
   * Called whenever the effective query changes so the host route can persist
   * filter state to the URL (making it shareable and reversible). Optional —
   * scopes that do not back filters with the URL can omit it.
   * 每当有效查询发生变化时调用，以便宿主路由将筛选状态持久化到 URL
   *（使其可分享且可逆）。可选——不将筛选状态写入 URL 的 scope 可以省略它。
   */
  onQueryChange?: (query: SearchQuery) => void;
};

/**
 * Federated search interface with category navigation, advanced filters, and
 * result deduplication across multiple content types. Supports URL-backed
 * filter persistence and search history tracking.
 *
 * 联邦搜索界面，具有类别导航、高级筛选器和跨多个内容类型的结果去重。
 * 支持 URL 保存的筛选持久化和搜索历史跟踪。
 *
 * @layout
 *
 * Mobile <640px (px-4, py-8, max-w-4xl):
 * +-------+
 * |Title  |
 * +-------+
 * |Category|
 * |Nav    |
 * +-------+
 * |Search |
 * |Input  |
 * +-------+
 * |Filters|
 * +-------+
 * |History|
 * |or     |
 * |Results|
 * +-------+
 *
 * Tablet 640–1023px (px-4, py-8, max-w-4xl, centered):
 * +-----------+
 * |Title      |
 * +-----------+
 * |Category   |
 * |Nav        |
 * +-----------+
 * |Search     |
 * |Input      |
 * +-----------+
 * |Applied    |
 * |Filters    |
 * +-----------+
 * |History    |
 * |or         |
 * |Results    |
 * |(multi col)|
 * +-----------+
 *
 * Desktop 1024–1535px (px-4, py-8, max-w-4xl):
 * Centered at max-w-4xl, category nav in tabs/pills, results in 2-col grid
 *
 * Ultra-wide ≥1536px (px-4, py-8, max-w-4xl):
 * Centered at max-w-4xl, results in 2-col or 3-col grid per content type
 */
export function FederatedSearchPage({
  scope,
  initialQuery,
  implicitInitial,
  initialCategory = "all",
  onCategoryChange,
  onQueryChange,
}: FederatedSearchPageProps) {
  const { t } = useTranslation(["common"]);
  const injectedTags = useInjectedTags();

  const initial = useMemo<SearchQuery>(() => {
    const base: SearchQuery = initialQuery ?? {};
    if (injectedTags && injectedTags.length > 0) {
      return {
        ...base,
        tags: injectedTags.map((tag) => ({
          ...(tag.slug ? { slug: tag.slug } : {}),
          ...(tag.unitId ? { unitId: tag.unitId } : {}),
          ...(tag.name ? { name: tag.name } : {}),
        })),
      };
    }
    return base;
  }, [initialQuery, injectedTags]);

  const search = useSearchQuery({
    initial,
    implicitInitial,
    middleware: parseSearchString,
    scope,
    initialCategory,
  });

  const { data, isLoading } = useLocalizedFederatedSearch({
    scope,
    category: search.category,
    query: search.query,
  });

  const counts = useMemo(() => countsFromResult(data), [data]);
  const history = useSearchHistory();

  // Persist effective filter state to the host route (URL) so it is shareable
  // and reversible. The query hook owns local state; this mirrors it outward.
  // 将有效筛选状态持久化到宿主路由（URL），使其可分享且可逆。query hook
  // 拥有本地状态；此处将其向外镜像。
  useEffect(() => {
    onQueryChange?.(search.query);
  }, [search.query, onQueryChange]);

  const handleCategoryChange = (next: SearchCategory) => {
    search.setCategory(next);
    onCategoryChange(next);
  };

  const handleSubmit = () => {
    const keyword = search.query.keyword?.trim();
    if (keyword) history.record(keyword);
  };

  const showHistory = !search.query.keyword?.trim();

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">{t("common:accessibility_search")}</h1>
      <SearchCategoryNav
        scope={scope}
        value={search.category}
        counts={counts}
        onChange={handleCategoryChange}
      />
      <AdvancedSearch
        query={search.query}
        bind={search.bind}
        patch={search.patch}
        implicit={search.implicit}
        onSubmit={handleSubmit}
        middleware={search.middleware}
      />
      <AppliedFilterChips
        query={search.query}
        onRemove={(patch) => search.set(patch)}
      />
      {showHistory ? (
        <SearchHistory
          entries={history.entries}
          onSelect={(term) => {
            search.patch({ keyword: term });
            history.record(term);
          }}
          onRemove={history.remove}
          onClear={history.clear}
        />
      ) : null}
      <FederatedResultList
        result={data}
        isLoading={isLoading}
        scope={scope}
        onCategoryChange={handleCategoryChange}
      />
    </div>
  );
}

function countsFromResult(
  result: FederatedSearchResult | undefined,
): Partial<Record<SearchCategory, number>> {
  if (!result || result.kind !== "grouped") return {};
  const out: Partial<Record<SearchCategory, number>> = {};
  const s = result.sections;
  if (s.books) out.books = s.books.totalHits;
  if (s.reviews) out.reviews = s.reviews.totalHits;
  if (s.excerpts) out.excerpts = s.excerpts.totalHits;
  if (s.remarks) out.remarks = s.remarks.totalHits;
  if (s.posts) out.posts = s.posts.totalHits;
  if (s.shelves) out.shelves = s.shelves.totalHits;
  if (s.realms) out.realms = s.realms.totalHits;
  if (s.users) out.users = s.users.totalHits;
  if (s.entities) out.entities = s.entities.totalHits;
  return out;
}
