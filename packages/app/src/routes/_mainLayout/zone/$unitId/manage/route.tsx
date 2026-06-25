import { zonePortalQueryOptions } from "@rezics/contract/api/zone/zone.queries";
import { createFileRoute } from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { ZoneManageLayout } from "@/zone";

export const Route = createFileRoute("/_mainLayout/zone/$unitId/manage")({
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
  component: ZoneManageRoute,
});

function ZoneManageRoute() {
  const { unitId } = Route.useParams();
  return (
    <ZoneManageLayout
      unitId={unitId}
      routeLocation={{ kind: "unitId", zoneUnitId: unitId }}
    />
  );
}
