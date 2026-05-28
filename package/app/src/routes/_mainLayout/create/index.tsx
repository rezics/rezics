import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const CreatePage = lazyRouteComponent(() => import("@/create"), "CreatePage");

export const Route = createFileRoute("/_mainLayout/create/")({
  component: CreatePage,
});
