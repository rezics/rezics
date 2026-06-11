import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/$userId/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/user/$userId/profile",
      params,
      replace: true,
    });
  },
});
