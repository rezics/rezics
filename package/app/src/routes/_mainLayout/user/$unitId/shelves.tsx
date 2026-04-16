import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ShelvesTabSection = lazyRouteComponent(
  () => import("@/user/section/ShelvesTabSection"),
  "ShelvesTabSection",
);

export const Route = createFileRoute("/_mainLayout/user/$unitId/shelves")({
  component: ShelvesTabSection,
});
