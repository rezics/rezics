import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfRealm,
} from "@/core/routing/documentTitle";
import { RealmDetailLayout, useRealmDetail } from "@/realm";
import { RealmWikiTab } from "@/realm/components/RealmWikiTab";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import { realmDetailLocationFromSlugParams } from "@/realm/models/realmDetailRoutes";

function RealmSlugWikiRoute() {
  const params = Route.useParams();
  const { realm } = Route.useLoaderData();
  return (
    <RealmDetailLayout
      realmId={realm.unitId}
      routeLocation={realmDetailLocationFromSlugParams(params)}
    >
      <RealmSlugWikiTab />
    </RealmDetailLayout>
  );
}

function RealmSlugWikiTab() {
  const { routeLocation, realmId, realm } = useRealmDetail();
  return (
    <RealmWikiTab
      realmId={realmId}
      routeLocation={routeLocation}
      wikiSidebar={realm.extra?.wikiSidebar ?? null}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/wiki")({
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  head: ({ loaderData }) =>
    titleMeta(
      loaderData ? titleOfRealm(loaderData.realm) : null,
      titleLabel("entity:realm_tab_wiki"),
    ),
  component: RealmSlugWikiRoute,
});
