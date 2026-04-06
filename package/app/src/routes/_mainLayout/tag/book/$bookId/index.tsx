import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const TagByBookPage = lazyRouteComponent(
  () => import("@/tag/page/TagByUnitPage"),
  "TagByBookPage",
);

export const Route = createFileRoute("/_mainLayout/tag/book/$bookId/")({
  component: TagByBookPage,
});
