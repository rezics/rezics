import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const CompleteRegistrationPage = lazyRouteComponent(
  () => import("@/user/page/CompleteRegistrationPage"),
  "CompleteRegistrationPage",
);

export const Route = createFileRoute("/_mainLayout/complete-registration")({
  component: CompleteRegistrationPage,
});
