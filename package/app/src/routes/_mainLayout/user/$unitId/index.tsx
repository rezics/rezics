import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ProfileOverviewPage = lazyRouteComponent(
  () => import("@/user/pages/ProfileOverviewPage"),
  "ProfileOverviewPage",
);

export const Route = createFileRoute("/_mainLayout/user/$unitId/")({
  component: ProfileOverviewPage,
});
