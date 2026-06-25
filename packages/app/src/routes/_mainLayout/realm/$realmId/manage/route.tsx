import { realmDetailQuery } from "@rezics/contract/api/realm/realm.queries";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core";
import { RealmManageLayout } from "@/realm";
import { isRealmUnitIdParam } from "@/realm/models/realmDetailRoutes";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";

export const Route = createFileRoute("/_mainLayout/realm/$realmId/manage")({
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
  component: RealmManageRoute,
});

function RealmManageRoute() {
  const { realmId } = Route.useParams();
  return <RealmManageLayout realmId={realmId} />;
}
