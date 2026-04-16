import type { ContentSearchOptions, SearchQuery } from "@rezics/contract";
import { useContentSearch } from "@rezics/api/meili/meili.queries";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AdvancedSearch, SearchResultList } from "@/search";
import { searchQueryToOptions } from "@/search/model/searchQueryToOptions";

function GlobalSearchPage() {
  const [searchOpts, setSearchOpts] = useState<ContentSearchOptions>({});
  const [hasSearched, setHasSearched] = useState(false);

  const { data, isLoading } = useContentSearch(
    hasSearched ? searchOpts : ({} as ContentSearchOptions),
  );

  const handleSearch = (query: SearchQuery) => {
    const opts = searchQueryToOptions(query);
    setSearchOpts(opts);
    setHasSearched(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold mb-6">Search</h1>
      <AdvancedSearch onSearch={handleSearch} />
      {hasSearched && (
        <div className="mt-6">
          <SearchResultList result={data} isLoading={isLoading} />
        </div>
      )}
    </div>
  );
}

export const Route = createFileRoute("/_mainLayout/search/")({
  component: GlobalSearchPage,
});
