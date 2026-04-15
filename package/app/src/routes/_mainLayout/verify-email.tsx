import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/verify-email")({
  beforeLoad: () => {
    throw redirect({ to: "/complete-registration" });
  },
  component: () => null,
});
