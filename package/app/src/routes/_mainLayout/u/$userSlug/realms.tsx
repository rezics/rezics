import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RealmsTabSection = lazyRouteComponent(
  () => import("@/user/sections/RealmsTabSection"),
  "RealmsTabSection",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/realms")({
  component: RealmsTabSection,
});
