import type { ContentSearchOptions, SearchQuery } from "@rezics/contract";
import { useContentSearch } from "@rezics/api/meili/meili.queries";
import { Typography } from "@mui/material";
import type React from "react";
import { useState } from "react";
import { AdvancedSearch, SearchResultList } from "@/search";
import { searchQueryToOptions } from "@/search/models/searchQueryToOptions";
import { useZone } from "../hooks/useZone";

export type ZoneSearchPageProps = {
  slug: string;
  initialKeyword?: string;
};

export const ZoneSearchPage: React.FC<ZoneSearchPageProps> = ({
  slug,
  initialKeyword,
}) => {
  const { zone, isLoading: zoneLoading } = useZone(slug);
  const [searchOpts, setSearchOpts] = useState<ContentSearchOptions>({});
  const [hasSearched, setHasSearched] = useState(false);

  const { data, isLoading: searchLoading } = useContentSearch(
    hasSearched ? searchOpts : ({} as ContentSearchOptions),
  );

  if (zoneLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Typography color="text.secondary">Loading...</Typography>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <Typography variant="h5">Zone not found</Typography>
      </div>
    );
  }

  const handleSearch = (query: SearchQuery) => {
    const opts = searchQueryToOptions(query, zone.filters);
    setSearchOpts(opts);
    setHasSearched(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Typography variant="h5" className="mb-4">
        Search in {zone.name}
      </Typography>
      <AdvancedSearch
        preAppliedFilters={zone.filters}
        onSearch={handleSearch}
        initialQuery={initialKeyword ? { keyword: initialKeyword } : undefined}
      />
      {hasSearched && (
        <div className="mt-6">
          <SearchResultList result={data} isLoading={searchLoading} />
        </div>
      )}
    </div>
  );
};
