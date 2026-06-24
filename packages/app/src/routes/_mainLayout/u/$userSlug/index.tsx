import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/u/$userSlug/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/u/$userSlug/profile",
      params,
      replace: true,
    });
  },
});
