import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const UnitPage = lazyRouteComponent(
  () => import("@/unit/page/UnitPage"),
  "UnitPage",
);

export const Route = createFileRoute("/_mainLayout/unit/$unitId")({
  component: UnitPage,
});
