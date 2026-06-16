import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userSlugRouteLoaderData } from "@/routes/_mainLayout/u/$userSlug";

const ZoneListPage = lazyRouteComponent(
  () => import("@/zone/pages/ZoneListPage"),
  "ZoneListPage",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/zones")({
  head: ({ matches }) => {
    const userData = userSlugRouteLoaderData(matches);
    return titleMeta(
      userData ? titleOfUser(userData) : null,
      titleLabel("shell:navigation_zones"),
    );
  },
  component: ZoneListPage,
});
