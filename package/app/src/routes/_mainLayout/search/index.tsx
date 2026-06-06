import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { routeBoundaries } from "@/core/routing/routeBoundaries";
import { FederatedSearchPage, isSearchCategory } from "@/search";
import {
  parseSearchString,
  serializeSearchString,
} from "@/search/models/searchQuery";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
};

function GlobalSearchPage() {
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();

  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  return (
    <FederatedSearchPage
      scope={{ kind: "global" }}
      initialQuery={initialQuery}
      initialCategory={category ?? "all"}
      onCategoryChange={(next) => {
        navigate({
          to: "/search",
          search: (prev: SearchRouteParams) => ({
            ...prev,
            category: next === "all" ? undefined : next,
          }),
        });
      }}
      onQueryChange={(query) => {
        const serialized = serializeSearchString(query);
        navigate({
          to: "/search",
          replace: true,
          search: (prev: SearchRouteParams) => ({
            ...prev,
            q: serialized || undefined,
          }),
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/search/")({
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
  }),
  component: GlobalSearchPage,
  ...routeBoundaries(),
});
