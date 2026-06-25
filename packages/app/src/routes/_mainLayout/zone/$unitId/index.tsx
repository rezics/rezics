import { zonePortalQueryOptions } from "@rezics/contract/api/zone/zone";
import { createFileRoute } from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { ZonePortalPage } from "@/zone";

function ZoneUnitPortalRoute() {
  const { unitId } = Route.useParams();
  return <ZonePortalPage unitId={unitId} />;
}

export const Route = createFileRoute("/_mainLayout/zone/$unitId/")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    await routeQueryOrNotFound(
      context.qc,
      zonePortalQueryOptions(params.unitId, "home", {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
  },
  component: ZoneUnitPortalRoute,
});
