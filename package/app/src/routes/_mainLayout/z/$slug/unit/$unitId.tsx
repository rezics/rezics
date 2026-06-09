import { createFileRoute } from "@tanstack/react-router";
import { UnitPageById } from "@/unit";

export const Route = createFileRoute("/_mainLayout/z/$slug/unit/$unitId")({
  component: () => {
    const { unitId } = Route.useParams();
    return <UnitPageById unitId={unitId} />;
  },
});
