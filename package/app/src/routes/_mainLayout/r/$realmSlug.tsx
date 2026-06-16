import { isPublicRealmSlugRouteParams, type RealmDTO } from "@rezics/contract";
import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import {
  loaderDataByRouteId,
  titleOfRealm,
  unitTitleMeta,
} from "@/core/routing/documentTitle";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import type { ResolvedReadLanguageContext } from "@/shared/models/readLanguageContext";

export const Route = createFileRoute("/_mainLayout/r/$realmSlug")({
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  head: ({ loaderData }) =>
    unitTitleMeta(
      "realm",
      loaderData
        ? titleOfRealm(loaderData.realm, loaderData.readContext)
        : null,
    ),
  component: Outlet,
});

export type RealmSlugRouteLoaderData = {
  realm: RealmDTO;
  readContext: ResolvedReadLanguageContext;
};

export function realmSlugRouteLoaderData(
  matches: readonly { routeId: string; loaderData?: unknown }[],
) {
  return loaderDataByRouteId<RealmSlugRouteLoaderData>(
    matches,
    "/_mainLayout/r/$realmSlug",
  );
}
