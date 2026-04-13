import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RealmListPage = lazyRouteComponent(
  () => import("@/realm/page/RealmListPage"),
  "RealmListPage",
);

export const Route = createFileRoute("/_mainLayout/realm/")({
  component: RealmListPage,
});
