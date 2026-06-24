import { isPublicRealmSlugRouteParams } from "@rezics/contract";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { titleOfRealm, unitTitleMeta } from "@/core/routing/documentTitle";
import { RealmManageLayout } from "@/realm";
import { loadRealmSlugRoute } from "@/realm/models/realmSlugRoute";

function RealmSlugManageRoute() {
  const { realm } = Route.useLoaderData();
  const { realmSlug } = Route.useParams();

  return (
    <RealmManageLayout
      realmId={realm.unitId}
      routeLocation={{ kind: "slug", realmSlug }}
    />
  );
}

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/manage")({
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
  component: RealmSlugManageRoute,
});
