import { useContentSearch } from "@rezics/api/meili/meili.queries";
import type { ContentSearchOptions, SearchQuery } from "@rezics/contract";
import type React from "react";
import { useMemo, useState } from "react";
import { AdvancedSearch, SearchResultList } from "@/search";
import { useSearchQuery } from "@/search/hooks/useSearchQuery";
import { useAllowedRatings } from "@/user/hooks/useAllowedRatings";
import { useZone } from "../hooks/useZone";
import { useMessage } from "@rezics/i18n/react";
import {
  common_loading,
  zone_not_found,
  zone_search_title,
} from "@rezics/i18n/messages";
const i18nMessages = {
  common_loading,
  zone_not_found,
  zone_search_title,
};

export type ZoneSearchPageProps = {
  slug: string;
  initialKeyword?: string;
};

export const ZoneSearchPage: React.FC<ZoneSearchPageProps> = ({
  slug,
  initialKeyword,
}) => {
  const m = useMessage(i18nMessages);
  const { zone, isLoading: zoneLoading } = useZone(slug);
  const { allowed } = useAllowedRatings();

  const implicitInitial = useMemo<SearchQuery>(() => {
    const out: SearchQuery = { ratings: allowed };
    if (!zone?.filters) return out;
    const z = zone.filters;
    const types = Array.isArray(z.type) ? z.type : z.type ? [z.type] : [];
    if (types.length) out.type = types;
    if (z.tags?.length) out.tags = z.tags;
    if (z.realmId) out.realm = { scope: "realm", slug: z.realmId };
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
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <p className="text-text-secondary">{m.common_loading()}</p>
      </div>
    );
  }

  if (!zone) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <h2 className="text-2xl font-semibold">{m.zone_not_found()}</h2>
      </div>
    );
  }

  const handleSubmit = () => {
    setSearchOpts(search.toOptions());
    setHasSearched(true);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h2 className="text-2xl font-semibold mb-4">
        {m.zone_search_title({ name: zone.name })}
      </h2>
      <AdvancedSearch
        query={search.query}
        bind={search.bind}
        patch={search.patch}
        implicit={search.implicit}
        onSubmit={handleSubmit}
      />
      {hasSearched && (
        <div className="mt-8">
          <SearchResultList result={data} isLoading={searchLoading} />
        </div>
      )}
    </div>
  );
};
