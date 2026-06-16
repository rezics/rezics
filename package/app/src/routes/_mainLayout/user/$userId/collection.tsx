import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/$userId/collection")({
  loader: ({ params }) => {
    throw redirect({
      to: "/user/$userId/shelves/search",
      params: { userId: params.userId },
    });
  },
});
