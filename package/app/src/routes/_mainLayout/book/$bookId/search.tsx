import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  titleLabel,
  titleMeta,
  titleOfBook,
} from "@/core/routing/documentTitle";
import { FederatedSearchPage, isSearchCategory } from "@/search";
import { parseSearchString } from "@/search";
import { bookRouteLoaderData } from "./route";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
};

function BookScopedSearchPage() {
  const { bookId } = Route.useParams();
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();

  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  return (
    <FederatedSearchPage
      scope={{
        kind: "book",
        unitId: bookId,
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
  }),
  head: ({ matches }) => {
    const data = bookRouteLoaderData(matches);
    return titleMeta(
      data ? titleOfBook(data.book, data.readContext) : null,
      titleLabel("common:search"),
    );
  },
  component: BookScopedSearchPage,
});
