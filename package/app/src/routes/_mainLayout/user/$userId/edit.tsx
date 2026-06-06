import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const UserEditPage = lazyRouteComponent(
  () => import("@/user/pages/UserEditPage"),
  "UserEditPage",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/edit")({
  component: UserEditPage,
});
