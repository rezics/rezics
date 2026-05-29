import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core/routing/routeBoundaries";

const CreatePage = lazyRouteComponent(() => import("@/create"), "CreatePage");

export const Route = createFileRoute("/_mainLayout/create/")({
  component: CreatePage,
  ...routeBoundaries(),
});
