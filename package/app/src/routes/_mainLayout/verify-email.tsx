import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const VerifyEmailPage = lazyRouteComponent(
  () => import("@/user/page/VerifyEmailPage"),
  "VerifyEmailPage",
);

export const Route = createFileRoute("/_mainLayout/verify-email")({
  component: VerifyEmailPage,
});
