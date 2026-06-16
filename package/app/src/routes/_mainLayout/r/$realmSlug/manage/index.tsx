import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/r/$realmSlug/manage/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/r/$realmSlug/manage/profile",
      params,
    });
  },
});
