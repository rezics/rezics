import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/z/$slug/search")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/zone/$slug/search",
      params: { slug: params.slug },
    });
  },
});
