import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/me/edit")({
  beforeLoad: () => {
    // TODO: redirect to /user/me/settings/profile once settings-page change lands
    throw redirect({ to: "/user/me" });
  },
});
