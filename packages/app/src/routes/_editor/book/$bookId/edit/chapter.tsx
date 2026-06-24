import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookEditChapterListPage = lazyRouteComponent(
  () => import("@/book-edit"),
  "BookEditChapterListPage",
);

export const Route = createFileRoute("/_editor/book/$bookId/edit/chapter")({
  component: BookEditChapterListPage,
});
