import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/me/setting/")({
  beforeLoad: () => {
    throw redirect({ to: "/user/me/setting/profile" });
  },
});
