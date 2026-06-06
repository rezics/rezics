import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const TagByBookFullPage = lazyRouteComponent(
  () => import("@/tag/pages/TagByUnitPage"),
  "TagByBookFullPage",
);

export const Route = createFileRoute("/_mainLayout/tag/book/$bookId/tag/")({
  component: TagByBookFullPage,
});
