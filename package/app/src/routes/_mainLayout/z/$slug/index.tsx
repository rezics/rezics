import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/z/$slug/")({
  beforeLoad: ({ params }) => {
    throw redirect({ to: "/zone/$slug", params: { slug: params.slug } });
  },
});
