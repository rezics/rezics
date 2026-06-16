import { zoneQueries } from "@rezics/api/zone/zone";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { titleMeta, titleOfZone } from "@/core/routing/documentTitle";
import { resolveRouteReadLanguageContext } from "@/shared/models/readLanguageContext";
import { ZonePortalPage } from "@/zone";

function ZoneCustomPageRoute() {
  const { slug, pageSlug } = Route.useParams();
  return <ZonePortalPage slug={slug} pageSlug={pageSlug} />;
}

export const Route = createFileRoute("/_mainLayout/z/$slug/page/$pageSlug")({
  loader: async ({ params, context }) => {
    const readContext = await resolveRouteReadLanguageContext(context.qc);
    const readQuery = {
      languages: readContext.languages,
      appLocale: readContext.appLocale,
    };
    const zone = await context.qc
      .ensureQueryData(zoneQueries.detail(params.slug, readQuery))
      .catch(() => {
        throw notFound();
      });
    const portal = await context.qc
      .ensureQueryData(
        zoneQueries.portal(zone.unitId, params.pageSlug, readQuery),
      )
      .catch(() => {
        throw notFound();
      });
    return { portal, readContext };
  },
  head: ({ loaderData }) =>
    titleMeta(
      loaderData?.portal.page.slug,
      loaderData ? titleOfZone(loaderData.portal.zone) : null,
    ),
  component: ZoneCustomPageRoute,
});
