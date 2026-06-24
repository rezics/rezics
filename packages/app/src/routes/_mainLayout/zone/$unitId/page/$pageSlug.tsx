import { zonePortalQueryOptions } from "@rezics/api";
import { createFileRoute } from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { ZonePortalPage } from "@/zone";

function ZoneUnitCustomPageRoute() {
  const { unitId, pageSlug } = Route.useParams();
  return <ZonePortalPage unitId={unitId} pageSlug={pageSlug} />;
}

export const Route = createFileRoute(
  "/_mainLayout/zone/$unitId/page/$pageSlug",
)({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    await routeQueryOrNotFound(
      context.qc,
      zonePortalQueryOptions(params.unitId, params.pageSlug, {
        languages: readContext.languages,
        appLocale: readContext.appLocale,
      }),
    );
  },
  component: ZoneUnitCustomPageRoute,
});
