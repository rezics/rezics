import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const EntityEditPage = lazyRouteComponent(
  () => import("@/entity-edit"),
  "EntityEditPage",
);

export const Route = createFileRoute("/_mainLayout/entity/$unitId/edit")({
  component: () => {
    const { unitId } = Route.useParams();
    return <EntityEditPage unitId={unitId} />;
  },
});
