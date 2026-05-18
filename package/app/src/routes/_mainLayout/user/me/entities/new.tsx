import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/me/entities/new")({
  component: lazyRouteComponent(
    () => import("@/entity-self-claim"),
    "NewEntityPage",
  ),
});
