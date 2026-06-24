import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookReadNodePage = lazyRouteComponent(
  () => import("@/book-read-node/sections/BookReadNodePage"),
  "BookReadNodePage",
);

export const Route = createFileRoute("/book_/$bookId/node/$nodeId/")({
  component: BookReadNodePage,
});
