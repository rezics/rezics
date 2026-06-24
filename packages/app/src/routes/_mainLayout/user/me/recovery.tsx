import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/me/recovery")({
  component: lazyRouteComponent(
    () => import("@/user/pages/SubscriptionRecoveryPage"),
    "SubscriptionRecoveryPage",
  ),
});
