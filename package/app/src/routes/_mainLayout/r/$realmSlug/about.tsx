import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfRealm,
} from "@/core/routing/documentTitle";
import { RealmDetailLayout, useRealmDetail } from "@/realm";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import { realmDetailLocationFromSlugParams } from "@/realm/models/realmDetailRoutes";
import { RealmAboutTab } from "@/realm/sections/RealmAboutTab";

function RealmSlugAboutRoute() {
  const params = Route.useParams();
  const { realm } = Route.useLoaderData();
  return (
    <RealmDetailLayout
      realmId={realm.unitId}
      routeLocation={realmDetailLocationFromSlugParams(params)}
    >
      <RealmSlugAboutTab />
    </RealmDetailLayout>
  );
}

function RealmSlugAboutTab() {
  const { realm, membership, showManage } = useRealmDetail();
  return (
    <RealmAboutTab
      realm={realm}
      membership={membership}
      canManage={showManage}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/about")({
  loader: async ({ params, context }) => {
    if (!isPublicRealmSlugRouteParams(params)) throw notFound();
    return loadRealmSlugRoute({
      params,
      queryClient: context.qc,
    });
  },
  head: async ({ loaderData }) =>
    titleMeta(
      loaderData ? titleOfRealm(loaderData.realm) : null,
      await resolveTitleLabel("entity:realm_tab_about"),
    ),
  component: RealmSlugAboutRoute,
});
