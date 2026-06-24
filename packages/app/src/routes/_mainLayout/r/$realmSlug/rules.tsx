import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { titleOfRealm, unitTitleMeta } from "@/core/routing/documentTitle";
import { RealmDetailLayout, useRealmDetail } from "@/realm";
import { realmDetailLocationFromSlugParams } from "@/realm/models/realmDetailRoutes";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";
import { RuleSection } from "@/realm/sections/RuleSection";

function RealmSlugRulesRoute() {
  const params = Route.useParams();
  const { realm } = Route.useLoaderData();
  return (
    <RealmDetailLayout
      realmId={realm.unitId}
      routeLocation={realmDetailLocationFromSlugParams(params)}
    >
      <RealmSlugRulesTab />
    </RealmDetailLayout>
  );
}

function RealmSlugRulesTab() {
  const { realmId } = useRealmDetail();
  return <RuleSection realmUnitId={realmId} empty="state" />;
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/rules")({
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
  component: RealmSlugRulesRoute,
});
