import type {
  FederatedSearchResult,
  SearchCategory,
  SearchQuery,
  SearchScope,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { useEffect, useMemo } from "react";
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
import { useLocalizedFederatedSearch } from "@/shared/hooks/useLocalizedMeiliSearch";

export { isSearchCategory } from "../models/category";

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

export type FederatedSearchPageProps = {
  scope: SearchScope;
  initialQuery?: SearchQuery;
  initialCategory?: SearchCategory;
  onCategoryChange: (next: SearchCategory) => void;
  /**
   * Called whenever the effective query changes so the host route can persist
   * filter state to the URL (making it shareable and reversible). Optional —
   * scopes that do not back filters with the URL can omit it.
   */
  onQueryChange?: (query: SearchQuery) => void;
};

export function FederatedSearchPage({
  scope,
  initialQuery,
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
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
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
