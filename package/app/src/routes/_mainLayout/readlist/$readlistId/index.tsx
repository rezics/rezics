import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ReadListPage = lazyRouteComponent(
  () => import("@/readlist/page/ReadListPage"),
  "ReadListPage",
);

export const Route = createFileRoute("/_mainLayout/readlist/$readlistId/")({
  component: ReadListPage,
});
