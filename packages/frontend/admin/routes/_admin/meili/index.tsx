import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const MeiliPage = lazyRouteComponent(
  () => import("@/admin/meili/pages/MeiliPage"),
  "MeiliPage",
);

export const Route = createFileRoute("/_admin/meili/")({
  component: MeiliPage,
});
