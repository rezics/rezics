import { useContentSearch } from "@rezics/api/meili/meili.queries";
import type { ContentSearchOptions, SearchQuery } from "@rezics/contract";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AdvancedSearch, SearchResultList } from "@/search";
import { useInjectedTags } from "@/search/hooks/useInjectedTags";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { parseSearchString } from "@/search/models/searchQuery";

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

  const search = useSearchQuery({
    initial: initialQuery,
    middleware: parseSearchString,
  });

  const [searchOpts, setSearchOpts] = useState<ContentSearchOptions>(() =>
    search.toOptions(),
  );
  const [hasSearched, setHasSearched] = useState(() =>
    Boolean(initialQuery.tags?.length || initialQuery.keyword),
  );

  useEffect(() => {
    if (initialQuery.tags?.length || initialQuery.keyword) {
      setSearchOpts(search.toOptions());
      setHasSearched(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  const { data, isLoading } = useContentSearch(
    hasSearched ? searchOpts : ({} as ContentSearchOptions),
  );

  const handleSubmit = () => {
    setSearchOpts(search.toOptions());
    setHasSearched(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <AdvancedSearch
        query={search.query}
        bind={search.bind}
        patch={search.patch}
        implicit={search.implicit}
        onSubmit={handleSubmit}
        middleware={search.middleware}
      />
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
