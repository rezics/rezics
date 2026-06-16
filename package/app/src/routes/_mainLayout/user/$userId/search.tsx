import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  titleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userIdRouteLoaderData } from "@/routes/_mainLayout/user/$userId";
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
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
  }),
  head: ({ matches }) => {
    const userData = userIdRouteLoaderData(matches);
    return titleMeta(
      userData ? titleOfUser(userData) : null,
      titleLabel("common:search"),
    );
  },
  component: UserScopedSearchPage,
});
