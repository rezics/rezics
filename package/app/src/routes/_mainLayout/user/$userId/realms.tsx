import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RealmsTabSection = lazyRouteComponent(
  () => import("@/user/sections/RealmsTabSection"),
  "RealmsTabSection",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/realms")({
  component: RealmsTabSection,
});
