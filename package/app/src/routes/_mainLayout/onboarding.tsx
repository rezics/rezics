import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/onboarding")({
  beforeLoad: () => {
    throw redirect({ to: "/complete-registration" });
  },
  component: () => null,
});
