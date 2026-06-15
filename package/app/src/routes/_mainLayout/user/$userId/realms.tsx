import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import {
  resolveTitleLabel,
  titleMeta,
  titleOfUser,
} from "@/core/routing/documentTitle";
import { userIdChildRouteLoader } from "@/routes/_mainLayout/user/$userId";

const RealmListPage = lazyRouteComponent(
  () => import("@/realm/pages/RealmListPage"),
  "RealmListPage",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/realms")({
  loader: userIdChildRouteLoader,
  head: async ({ loaderData }) =>
    titleMeta(
      titleOfUser(loaderData),
      await resolveTitleLabel("shell:navigation_realms"),
    ),
  component: RealmListPage,
});
