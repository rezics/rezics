import {
  isPublicRealmSlugRouteParams,
  type SearchCategory,
  type SearchQuery,
} from "@rezics/contract";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import {
  titleLabel,
  titleMeta,
  titleOfRealm,
} from "@/core/routing/documentTitle";
import { isSearchCategory, parseSearchString } from "@/search";
import { FederatedSearchPage } from "@/search";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";

type SearchRouteParams = {
  q?: string;
  category?: SearchCategory;
};

function RealmSlugScopedSearchPage() {
  const params = Route.useParams();
  const { realm } = Route.useLoaderData();
  const { q, category } = Route.useSearch();
  const navigate = useNavigate();

  const initialQuery = useMemo<SearchQuery>(
    () => (q ? parseSearchString(q) : {}),
    [q],
  );

  return (
    <FederatedSearchPage
      scope={{ kind: "realm", realmId: realm.unitId }}
      initialQuery={initialQuery}
      initialCategory={category ?? "all"}
      onCategoryChange={(next) => {
        navigate({
          to: "/r/$realmSlug/search",
          params,
          search: (prev: SearchRouteParams) => ({
            ...prev,
            category: next === "all" ? undefined : next,
          }),
        });
      }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/search")({
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  validateSearch: (search: Record<string, unknown>): SearchRouteParams => ({
    q: typeof search.q === "string" ? search.q : undefined,
    category:
      typeof search.category === "string" && isSearchCategory(search.category)
        ? search.category
        : undefined,
  }),
  head: ({ loaderData }) =>
    titleMeta(
      loaderData ? titleOfRealm(loaderData.realm) : null,
      titleLabel("common:search"),
    ),
  component: RealmSlugScopedSearchPage,
});
