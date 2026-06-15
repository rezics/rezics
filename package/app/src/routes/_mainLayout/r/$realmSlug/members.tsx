import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfRealm,
} from "@/core/routing/documentTitle";
import { RealmDetailLayout, useRealmDetail } from "@/realm";
import { RealmMemberList } from "@/realm/components/RealmMemberList";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import { realmDetailLocationFromSlugParams } from "@/realm/models/realmDetailRoutes";

function RealmSlugMembersRoute() {
  const params = Route.useParams();
  const { realm } = Route.useLoaderData();
  return (
    <RealmDetailLayout
      realmId={realm.unitId}
      routeLocation={realmDetailLocationFromSlugParams(params)}
    >
      <RealmSlugMembersTab />
    </RealmDetailLayout>
  );
}

function RealmSlugMembersTab() {
  const { realmId } = useRealmDetail();
  return <RealmMemberList realmId={realmId} />;
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/members")({
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
      titleLabel("entity:realm_tab_members"),
    ),
  component: RealmSlugMembersRoute,
});
