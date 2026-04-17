import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RealmSearchPage = lazyRouteComponent(
  () => import("@/realm/pages/RealmSearchPage"),
  "RealmSearchPage",
);

export const Route = createFileRoute("/_mainLayout/realm/search")({
  component: RealmSearchPage,
});
