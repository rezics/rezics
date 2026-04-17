import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const NewRealmPage = lazyRouteComponent(
  () => import("@/realm/pages/NewRealmPage"),
  "NewRealmPage",
);

export const Route = createFileRoute("/_mainLayout/realm/new")({
  component: NewRealmPage,
});
