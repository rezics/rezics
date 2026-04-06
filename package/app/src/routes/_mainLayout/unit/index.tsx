import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const UnitsPage = lazyRouteComponent(
  () => import("@/unit/page/UnitsPage"),
  "UnitsPage",
);

export const Route = createFileRoute("/_mainLayout/unit/")({
  component: UnitsPage,
});
