import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookEditChapterListPage = lazyRouteComponent(
  () => import("@/book-edit"),
  "BookEditChapterListPage",
);

export const Route = createFileRoute("/book_/$bookId/edit/chapter")({
  component: BookEditChapterListPage,
});
