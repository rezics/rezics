import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/z/$slug/manage/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/z/$slug/manage/profile",
      params,
    });
  },
});
