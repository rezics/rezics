import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RealmsTabSection = lazyRouteComponent(
  () => import("@/user/section/RealmsTabSection"),
  "RealmsTabSection",
);

export const Route = createFileRoute("/_mainLayout/user/$unitId/realms")({
  component: RealmsTabSection,
});
