import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReadListsPage = lazyRouteComponent(
  () => import("@/readlist/page/ReadListsPage"),
  "ReadListsPage",
);

export const Route = createFileRoute("/_mainLayout/readlist/")({
  component: ReadListsPage,
});
