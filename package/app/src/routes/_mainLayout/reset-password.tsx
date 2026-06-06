import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ResetPasswordPage = lazyRouteComponent(
  () => import("@/user/pages/ResetPasswordPage"),
  "ResetPasswordPage",
);

export const Route = createFileRoute("/_mainLayout/reset-password")({
  component: ResetPasswordPage,
});
