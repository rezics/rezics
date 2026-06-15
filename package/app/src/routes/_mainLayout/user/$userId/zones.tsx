import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfUser, unitTitleMeta } from "@/core/routing/documentTitle";
import { userIdChildRouteLoader } from "@/routes/_mainLayout/user/$userId";

const ZoneListPage = lazyRouteComponent(
  () => import("@/zone/pages/ZoneListPage"),
  "ZoneListPage",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/zones")({
  loader: userIdChildRouteLoader,
  head: ({ loaderData }) => unitTitleMeta("user", titleOfUser(loaderData)),
  component: ZoneListPage,
});
