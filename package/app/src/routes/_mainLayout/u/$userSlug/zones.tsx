import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfUser, unitTitleMeta } from "@/core/routing/documentTitle";
import { userSlugChildRouteLoader } from "@/routes/_mainLayout/u/$userSlug";

const ZoneListPage = lazyRouteComponent(
  () => import("@/zone/pages/ZoneListPage"),
  "ZoneListPage",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/zones")({
  loader: userSlugChildRouteLoader,
  head: ({ loaderData }) => unitTitleMeta("user", titleOfUser(loaderData)),
  component: ZoneListPage,
});
