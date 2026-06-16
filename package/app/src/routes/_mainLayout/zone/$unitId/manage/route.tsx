import { createFileRoute } from "@tanstack/react-router";
import { ZoneManageLayout } from "@/zone";

export const Route = createFileRoute("/_mainLayout/zone/$unitId/manage")({
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
