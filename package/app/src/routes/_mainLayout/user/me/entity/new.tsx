import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/me/entity/new")({
  component: lazyRouteComponent(() => import("@/entity"), "NewEntityPage"),
});
