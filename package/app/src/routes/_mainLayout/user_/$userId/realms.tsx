import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RealmListPage = lazyRouteComponent(
  () => import("@/realm/pages/RealmListPage"),
  "RealmListPage",
);

export const Route = createFileRoute("/_mainLayout/user_/$userId/realms")({
  component: RealmListPage,
});
