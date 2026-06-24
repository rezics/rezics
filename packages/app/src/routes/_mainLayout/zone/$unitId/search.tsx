import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { isSearchCategory, parseSearchString } from "@/search";
import { ZoneSearchPage } from "@/zone";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
};

function ZoneUnitSearchRoute() {
  const { unitId } = Route.useParams();
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();
  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  return (
    <ZoneSearchPage
      unitId={unitId}
      initialQuery={initialQuery}
      initialCategory={category ?? "all"}
      onCategoryChange={(next) => {
        navigate({
          to: "/zone/$unitId/search",
          params: { unitId },
          search: (prev: SearchRouteParams) => ({
            ...prev,
            category: next === "all" ? undefined : next,
          }),
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/zone/$unitId/search")({
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
  }),
  component: ZoneUnitSearchRoute,
});
