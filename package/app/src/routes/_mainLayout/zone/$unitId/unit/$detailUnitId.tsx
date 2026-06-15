import { createFileRoute } from "@tanstack/react-router";
import { UnitPageById } from "@/unit";

export const Route = createFileRoute(
  "/_mainLayout/zone/$unitId/unit/$detailUnitId",
)({
  component: () => {
    const { detailUnitId } = Route.useParams();
    return <UnitPageById unitId={detailUnitId} />;
  },
});
