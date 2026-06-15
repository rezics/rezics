import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  titleLabel,
  titleMeta,
  titleOfZone,
} from "@/core/routing/documentTitle";
import { isSearchCategory, parseSearchString } from "@/search";
import { ZoneSearchPage } from "@/zone";
import { zoneSlugRouteLoaderData } from "./route";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
};

function ZoneSearchRoute() {
  const { slug } = Route.useParams();
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();
  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  return (
    <ZoneSearchPage
      slug={slug}
      initialQuery={initialQuery}
      initialCategory={category ?? "all"}
      onCategoryChange={(next) => {
        navigate({
          to: "/z/$slug/search",
          params: { slug },
          search: (prev: SearchRouteParams) => ({
            ...prev,
            category: next === "all" ? undefined : next,
          }),
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/z/$slug/search")({
  component: ZoneSearchRoute,
  head: ({ matches }) => {
    const data = zoneSlugRouteLoaderData(matches);
    return titleMeta(
      data ? titleOfZone(data.zone) : null,
      titleLabel("common:search"),
    );
  },
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
  }),
});
