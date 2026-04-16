import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/me/edit")({
  beforeLoad: () => {
    throw redirect({ to: "/user/me/settings/profile" });
  },
});
