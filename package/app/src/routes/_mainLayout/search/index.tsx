import { useContentSearch } from "@rezics/api/meili/meili.queries";
import type { ContentSearchOptions, SearchQuery } from "@rezics/contract";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdvancedSearch, SearchResultList } from "@/search";
import { useInjectedTags } from "@/search/hooks/useInjectedTags";
import { parseSearchString } from "@/search/models/searchQuery";
import { searchQueryToOptions } from "@/search/models/searchQueryToOptions";

type SearchRouteParams = {
  q?: string;
};

function GlobalSearchPage() {
  const { q } = Route.useSearch();
  const injectedTags = useInjectedTags();

  const initialQuery = useMemo<SearchQuery>(() => {
    const parsed = q ? parseSearchString(q) : {};
    if (injectedTags && injectedTags.length > 0) {
      return {
        ...parsed,
        tags: injectedTags.map((tag) => ({
          slug: tag.slug ?? "",
          unitId: tag.unitId,
        })),
      };
    }
    return parsed;
  }, [q, injectedTags]);

  const [searchOpts, setSearchOpts] = useState<ContentSearchOptions>(() =>
    searchQueryToOptions(initialQuery),
  );
  const [hasSearched, setHasSearched] = useState(() =>
    Boolean(initialQuery.tags?.length || initialQuery.keyword),
  );

  useEffect(() => {
    if (initialQuery.tags?.length || initialQuery.keyword) {
      setSearchOpts(searchQueryToOptions(initialQuery));
      setHasSearched(true);
    }
  }, [initialQuery]);

  const { data, isLoading } = useContentSearch(
    hasSearched ? searchOpts : ({} as ContentSearchOptions),
  );

  const handleSearch = (query: SearchQuery) => {
    setSearchOpts(searchQueryToOptions(query));
    setHasSearched(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <AdvancedSearch onSearch={handleSearch} initialQuery={initialQuery} />
      {hasSearched && (
        <div className="mt-6">
          <SearchResultList result={data} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_mainLayout/search/")({
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: GlobalSearchPage,
});
