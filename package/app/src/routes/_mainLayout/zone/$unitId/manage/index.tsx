import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/zone/$unitId/manage/")({
  beforeLoad: ({ params }) => {
    throw redirect({
      to: "/zone/$unitId/manage/profile",
      params,
    });
  },
});
