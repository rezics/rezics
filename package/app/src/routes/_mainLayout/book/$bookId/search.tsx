import { bookQueries } from "@rezics/api/book/book";
import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { releaseWorkUnitId } from "@/book-library/models/releaseWork";
import { FederatedSearchPage, isSearchCategory } from "@/search";
import { parseSearchString } from "@/search/models/searchQuery";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
  scope?: "work" | "exact";
};

function BookScopedSearchPage() {
  const { bookId } = Route.useParams();
  const { q, category } = Route.useSearch();
  const { scope } = Route.useSearch();
  const navigate = useNavigate();
  const { data: bookInfo } = useQuery({
    ...bookQueries.detail(bookId),
    enabled: Boolean(bookId),
  });
  const workUnitId =
    scope === "exact" ? undefined : releaseWorkUnitId(bookInfo);

  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  return (
    <FederatedSearchPage
      scope={{
        kind: "book",
        unitId: bookId,
        ...(workUnitId ? { workUnitId, scopeMode: "work" as const } : {}),
      }}
      initialQuery={initialQuery}
      initialCategory={category ?? "all"}
      onCategoryChange={(next) => {
        navigate({
          to: "/book/$bookId/search",
          params: { bookId },
          search: (prev: SearchRouteParams) => ({
            ...prev,
            category: next === "all" ? undefined : next,
          }),
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/book/$bookId/search")({
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
    scope:
      search.scope === "work" || search.scope === "exact"
        ? search.scope
        : undefined,
  }),
  component: BookScopedSearchPage,
});
