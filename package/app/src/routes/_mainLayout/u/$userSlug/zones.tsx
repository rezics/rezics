import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ZoneListPage = lazyRouteComponent(
  () => import("@/zone/pages/ZoneListPage"),
  "ZoneListPage",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/zones")({
  component: ZoneListPage,
});
