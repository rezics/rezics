import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  titleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userIdRouteLoaderData } from "@/routes/_mainLayout/user/$userId";

const RealmListPage = lazyRouteComponent(
  () => import("@/realm/pages/RealmListPage"),
  "RealmListPage",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/realms")({
  head: ({ matches }) => {
    const userData = userIdRouteLoaderData(matches);
    return titleMeta(
      userData ? titleOfUser(userData) : null,
      titleLabel("shell:navigation_realms"),
    );
  },
  component: RealmListPage,
});
