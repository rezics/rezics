import { userBySlugQuery } from "@rezics/api/user/user.queries";
import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { Spinner } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { FederatedSearchPage, isSearchCategory } from "@/search";
import { parseSearchString } from "@/search/models/searchQuery";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
};

function UserSlugScopedSearchPage() {
  const { userSlug } = Route.useParams();
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();
  const { data: user, isLoading } = useQuery(userBySlugQuery(userSlug));

  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  if (isLoading || !user) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  return (
    <FederatedSearchPage
      scope={{ kind: "user", userId: user.id }}
      initialQuery={initialQuery}
      initialCategory={category ?? "all"}
      onCategoryChange={(next) => {
        navigate({
          to: "/u/$userSlug/search",
          params: { userSlug },
          search: (prev: SearchRouteParams) => ({
            ...prev,
            category: next === "all" ? undefined : next,
          }),
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/u/$userSlug/search")({
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
  }),
  component: UserSlugScopedSearchPage,
});
