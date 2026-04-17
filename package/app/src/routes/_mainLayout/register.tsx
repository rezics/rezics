import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const RegisterPage = lazyRouteComponent(
  () => import("@/user/pages/RegisterPage"),
  "RegisterPage",
);

export const Route = createFileRoute("/_mainLayout/register")({
  component: RegisterPage,
});
