import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const TagByBookFullPage = lazyRouteComponent(
  () => import("@/tag/page/TagByUnitPage"),
  "TagByBookFullPage",
);

export const Route = createFileRoute("/_mainLayout/tag/book/$bookId/tag/")({
  component: TagByBookFullPage,
});
