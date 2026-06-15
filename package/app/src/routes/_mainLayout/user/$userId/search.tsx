import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { titleOfUser, unitTitleMeta } from "@/core/routing/documentTitle";
import { userIdChildRouteLoader } from "@/routes/_mainLayout/user/$userId";
import { FederatedSearchPage, isSearchCategory } from "@/search";
import { parseSearchString } from "@/search";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
};

function UserScopedSearchPage() {
  const { userId } = Route.useParams();
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();

  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  return (
    <FederatedSearchPage
      scope={{ kind: "user", userId }}
      initialQuery={initialQuery}
      initialCategory={category ?? "all"}
      onCategoryChange={(next) => {
        navigate({
          to: "/user/$userId/search",
          params: { userId },
          search: (prev: SearchRouteParams) => ({
            ...prev,
            category: next === "all" ? undefined : next,
          }),
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/user/$userId/search")({
  loader: userIdChildRouteLoader,
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
  }),
  head: ({ loaderData }) => unitTitleMeta("user", titleOfUser(loaderData)),
  component: UserScopedSearchPage,
});
