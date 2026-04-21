import { Typography } from "@mui/material";
import { useContentSearch } from "@rezics/api/meili/meili.queries";
import type { ContentSearchOptions, SearchQuery } from "@rezics/contract";
import type React from "react";
import { useMemo, useState } from "react";
import { AdvancedSearch, SearchResultList } from "@/search";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { useAllowedRatings } from "@/user/hooks/useAllowedRatings";
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
  const { allowed } = useAllowedRatings();

  const implicitInitial = useMemo<SearchQuery>(() => {
    const out: SearchQuery = { ratings: allowed };
    if (!zone?.filters) return out;
    const z = zone.filters;
    const types = Array.isArray(z.type) ? z.type : z.type ? [z.type] : [];
    if (types.length) out.type = types;
    if (z.tags?.length) out.tags = z.tags;
    if (z.realmId) out.realm = { slug: z.realmId };
    if (z.languages?.length) out.languages = z.languages;
    if (z.ratings?.length) {
      out.ratings = z.ratings.filter((r) => allowed.includes(r));
    }
    if (z.isLicensed !== undefined) out.isLicensed = z.isLicensed;
    return out;
  }, [zone, allowed]);

  const search = useSearchQuery({
    initial: initialKeyword ? { keyword: initialKeyword } : {},
    implicitInitial,
  });

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

  const handleSubmit = () => {
    setSearchOpts(search.toOptions());
    setHasSearched(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <Typography variant="h5" className="mb-4">
        Search in {zone.name}
      </Typography>
      <AdvancedSearch
        query={search.query}
        bind={search.bind}
        patch={search.patch}
        implicit={search.implicit}
        onSubmit={handleSubmit}
      />
      {hasSearched && (
        <div className="mt-6">
          <SearchResultList result={data} isLoading={searchLoading} />
        </div>
      )}
    </div>
  );
};
