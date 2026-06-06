import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/me/entity/")({
  component: lazyRouteComponent(() => import("@/entity"), "MyEntitiesPage"),
});
