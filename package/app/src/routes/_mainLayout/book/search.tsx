import { createFileRoute } from "@tanstack/react-router";
import { BookLibPage } from "@/book-library/page/BookLibPage";

export const Route = createFileRoute("/_mainLayout/book/search")({
  component: BookLibPage,
});
