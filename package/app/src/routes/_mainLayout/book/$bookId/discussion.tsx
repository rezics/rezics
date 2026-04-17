import { createFileRoute } from "@tanstack/react-router";
import { BookDiscussionPage } from "@/book-library/pages/BookDiscussionPage";

export const Route = createFileRoute("/_mainLayout/book/$bookId/discussion")({
  component: BookDiscussionPage,
});
