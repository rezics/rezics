import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { FederatedSearchPage, isSearchCategory } from "@/search";
import { parseSearchString } from "@/search";
import { isRealmUnitIdParam } from "@/realm/models/realmDetailRoutes";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
};

function RealmScopedSearchPage() {
  const { realmId } = Route.useParams();
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();

  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  return (
    <FederatedSearchPage
      scope={{ kind: "realm", realmId }}
      initialQuery={initialQuery}
      initialCategory={category ?? "all"}
      onCategoryChange={(next) => {
        navigate({
          to: "/realm/$realmId/search",
          params: { realmId },
          search: (prev: SearchRouteParams) => ({
            ...prev,
            category: next === "all" ? undefined : next,
          }),
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/realm/$realmId/search")({
  loader: ({ params }) => {
    if (!isRealmUnitIdParam(params.realmId)) throw notFound();
  },
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
  }),
  component: RealmScopedSearchPage,
});
