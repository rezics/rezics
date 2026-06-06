import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const BookEditTagPage = lazyRouteComponent(
  () => import("@/book-edit"),
  "BookEditTagPage",
);

export const Route = createFileRoute("/_editor/book/$bookId/edit/tag")({
  component: BookEditTagPage,
});
