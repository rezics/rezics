import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/book/$bookId/history")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/book/$bookId/edit/history",
      params,
    });
  },
});
