import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ProfileShell = lazyRouteComponent(
  () => import("@/user/component/ProfileShell"),
  "ProfileShell",
);

export const Route = createFileRoute("/_mainLayout/user/$unitId")({
  component: ProfileShell,
});
