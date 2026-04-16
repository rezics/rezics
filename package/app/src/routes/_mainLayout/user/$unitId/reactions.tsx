import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReactionsTabSection = lazyRouteComponent(
  () => import("@/user/section/ReactionsTabSection"),
  "ReactionsTabSection",
);

export const Route = createFileRoute("/_mainLayout/user/$unitId/reactions")({
  component: ReactionsTabSection,
});
