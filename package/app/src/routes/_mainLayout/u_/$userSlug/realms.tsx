import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RealmListPage = lazyRouteComponent(
  () => import("@/realm/pages/RealmListPage"),
  "RealmListPage",
);

export const Route = createFileRoute("/_mainLayout/u_/$userSlug/realms")({
  component: RealmListPage,
});
