import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/u/$userSlug/profile/collection")({
  loader: ({ params }) => {
    throw redirect({
      to: "/u/$userSlug/profile/shelves/search",
      params: { userSlug: params.userSlug },
    });
  },
});
