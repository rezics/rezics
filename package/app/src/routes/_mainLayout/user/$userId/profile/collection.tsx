import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_mainLayout/user/$userId/profile/collection",
)({
  loader: ({ params }) => {
    throw redirect({
      to: "/user/$userId/profile/shelves/search",
      params: { userId: params.userId },
    });
  },
});
