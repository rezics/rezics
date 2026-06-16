import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userIdRouteLoaderData } from "@/routes/_mainLayout/user/$userId";

const ZoneListPage = lazyRouteComponent(
  () => import("@/zone/pages/ZoneListPage"),
  "ZoneListPage",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/zones")({
  head: ({ matches }) => {
    const userData = userIdRouteLoaderData(matches);
    return titleMeta(
      userData ? titleOfUser(userData) : null,
      titleLabel("shell:navigation_zones"),
    );
  },
  component: ZoneListPage,
});
