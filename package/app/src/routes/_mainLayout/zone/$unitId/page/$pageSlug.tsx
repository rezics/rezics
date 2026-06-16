import { createFileRoute } from "@tanstack/react-router";
import { ZonePortalPage } from "@/zone";

function ZoneUnitCustomPageRoute() {
  const { unitId, pageSlug } = Route.useParams();
  return <ZonePortalPage unitId={unitId} pageSlug={pageSlug} />;
}

export const Route = createFileRoute(
  "/_mainLayout/zone/$unitId/page/$pageSlug",
)({
  component: ZoneUnitCustomPageRoute,
});
