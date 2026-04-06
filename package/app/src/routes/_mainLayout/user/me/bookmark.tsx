import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookmarkPage = lazyRouteComponent(
  () => import("@/user/page/BookmarkPage"),
  "BookmarkPage",
);

export const Route = createFileRoute("/_mainLayout/user/me/bookmark")({
  component: BookmarkPage,
});
