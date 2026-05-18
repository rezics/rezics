import { useFederatedSearch } from "@rezics/api/meili/meili.federated";
import type {
  FederatedSearchResult,
  SearchCategory,
  SearchQuery,
  SearchScope,
} from "@rezics/contract";
import { useMemo } from "react";
import {
  AdvancedSearch,
  FederatedResultList,
  SearchCategoryNav,
} from "../components";
import { useInjectedTags } from "../hooks/useInjectedTags";
import { useSearchQuery } from "../hooks/useSearchQuery";
import { parseSearchString } from "../models/searchQuery";

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
  return out;
}

export type FederatedSearchPageProps = {
  scope: SearchScope;
  initialQuery?: SearchQuery;
  initialCategory?: SearchCategory;
  onCategoryChange: (next: SearchCategory) => void;
};

export function FederatedSearchPage({
  scope,
  initialQuery,
  initialCategory = "all",
  onCategoryChange,
}: FederatedSearchPageProps) {
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

  const { data, isLoading } = useFederatedSearch({
    scope,
    category: search.category,
    query: search.query,
  });

  const counts = useMemo(() => countsFromResult(data), [data]);

  const handleCategoryChange = (next: SearchCategory) => {
    search.setCategory(next);
    onCategoryChange(next);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold">Search</h1>
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
        onSubmit={() => {}}
        middleware={search.middleware}
      />
      <FederatedResultList
        result={data}
        isLoading={isLoading}
        scope={scope}
        onCategoryChange={handleCategoryChange}
      />
    </div>
  );
}
