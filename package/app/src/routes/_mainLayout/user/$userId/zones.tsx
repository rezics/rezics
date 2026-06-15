import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userIdChildRouteLoader } from "@/routes/_mainLayout/user/$userId";

const ZoneListPage = lazyRouteComponent(
  () => import("@/zone/pages/ZoneListPage"),
  "ZoneListPage",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/zones")({
  loader: userIdChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfUser(loaderData),
      await resolveTitleLabel("shell:navigation_zones"),
    ),
  component: ZoneListPage,
});
