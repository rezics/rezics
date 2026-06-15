import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userSlugChildRouteLoader } from "@/routes/_mainLayout/u/$userSlug";

const ZoneListPage = lazyRouteComponent(
  () => import("@/zone/pages/ZoneListPage"),
  "ZoneListPage",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/zones")({
  loader: userSlugChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfUser(loaderData),
      await resolveTitleLabel("shell:navigation_zones"),
    ),
  component: ZoneListPage,
});
