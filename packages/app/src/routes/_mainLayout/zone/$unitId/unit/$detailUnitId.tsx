import { zonePortalQueryOptions } from "@rezics/contract/api/zone/zone.queries";
import { unitDetailQuery } from "@rezics/contract/api/unit/unit.queries";
import { createFileRoute } from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { UnitPageById } from "@/unit";

export const Route = createFileRoute(
  "/_mainLayout/zone/$unitId/unit/$detailUnitId",
)({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const readQuery = {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    };
    await Promise.all([
      routeQueryOrNotFound(
        context.qc,
        zonePortalQueryOptions(params.unitId, "home", readQuery),
      ),
      routeQueryOrNotFound(
        context.qc,
        unitDetailQuery(params.detailUnitId, readQuery),
      ),
    ]);
  },
  component: () => {
    const { detailUnitId } = Route.useParams();
    return <UnitPageById unitId={detailUnitId} />;
  },
});
