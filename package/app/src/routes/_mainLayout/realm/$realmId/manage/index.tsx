import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/realm/$realmId/manage/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/realm/$realmId/manage/profile",
      params,
    });
  },
});
