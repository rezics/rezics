import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ShelfListPage = lazyRouteComponent(
  () => import("@/shelf/page/ShelfListPage"),
  "ShelfListPage",
);

export const Route = createFileRoute("/_mainLayout/shelf/")({
  component: ShelfListPage,
});
