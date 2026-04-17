import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const UnitPage = lazyRouteComponent(
  () => import("@/unit/pages/UnitPage"),
  "UnitPage",
);

export const Route = createFileRoute("/_mainLayout/unit/$unitId")({
  component: UnitPage,
});
