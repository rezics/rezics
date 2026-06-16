import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userSlugRouteLoaderData } from "@/routes/_mainLayout/u/$userSlug";

const RealmListPage = lazyRouteComponent(
  () => import("@/realm/pages/RealmListPage"),
  "RealmListPage",
);

export const Route = createFileRoute("/_mainLayout/u/$userSlug/realms")({
  head: ({ matches }) => {
    const userData = userSlugRouteLoaderData(matches);
    return titleMeta(
      userData ? titleOfUser(userData) : null,
      titleLabel("shell:navigation_realms"),
    );
  },
  component: RealmListPage,
});
