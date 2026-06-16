import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/u/$userSlug/collection")({
  loader: ({ params }) => {
    throw redirect({
      to: "/u/$userSlug/shelves/search",
      params: { userSlug: params.userSlug },
    });
  },
});
