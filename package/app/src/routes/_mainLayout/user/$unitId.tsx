import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ProfileLayout = lazyRouteComponent(
  () => import("@/user/components/ProfileLayout"),
  "ProfileLayout",
);

export const Route = createFileRoute("/_mainLayout/user/$unitId")({
  component: ProfileLayout,
});
