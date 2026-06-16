import { createFileRoute } from "@tanstack/react-router";
import { titleOfZone, unitTitleMeta } from "@/core/routing/documentTitle";
import { ZoneManageLayout } from "@/zone";
import { zoneSlugChildRouteLoader } from "../route";

export const Route = createFileRoute("/_mainLayout/z/$slug/manage")({
  loader: zoneSlugChildRouteLoader,
  head: ({ loaderData }) =>
    unitTitleMeta("zone", loaderData ? titleOfZone(loaderData.zone) : null),
  component: ZoneSlugManageRoute,
});

function ZoneSlugManageRoute() {
  const { slug } = Route.useParams();
  return (
    <ZoneManageLayout
      slug={slug}
      routeLocation={{ kind: "slug", zoneSlug: slug }}
    />
  );
}
