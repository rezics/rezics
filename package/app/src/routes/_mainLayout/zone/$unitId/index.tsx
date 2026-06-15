import { createFileRoute } from "@tanstack/react-router";
import { ZonePortalPage } from "@/zone";

function ZoneUnitPortalRoute() {
  const { unitId } = Route.useParams();
  return <ZonePortalPage unitId={unitId} />;
}

export const Route = createFileRoute("/_mainLayout/zone/$unitId/")({
  component: ZoneUnitPortalRoute,
});
