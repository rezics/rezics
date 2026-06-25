import { realmDetailQuery } from "@rezics/contract/api/realm/realm.queries";
import type { SearchCategory, SearchQuery } from "@rezics/contract";
import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { routeQueryOrNotFound } from "@/core";
import { FederatedSearchPage, isSearchCategory } from "@/search";
import { parseSearchString } from "@/search";
import { isRealmUnitIdParam } from "@/realm/models/realmDetailRoutes";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

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
  loader: async ({ params, context }) => {
    if (!isRealmUnitIdParam(params.realmId)) throw notFound();
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    await routeQueryOrNotFound(
      context.qc,
      realmDetailQuery(params.realmId, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
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
