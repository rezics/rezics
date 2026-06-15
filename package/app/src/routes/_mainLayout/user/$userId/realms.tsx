import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { titleOfUser, unitTitleMeta } from "@/core/routing/documentTitle";
import { userIdChildRouteLoader } from "@/routes/_mainLayout/user/$userId";

const RealmListPage = lazyRouteComponent(
  () => import("@/realm/pages/RealmListPage"),
  "RealmListPage",
);

export const Route = createFileRoute("/_mainLayout/user/$userId/realms")({
  loader: userIdChildRouteLoader,
  head: ({ loaderData }) => unitTitleMeta("user", titleOfUser(loaderData)),
  component: RealmListPage,
});
