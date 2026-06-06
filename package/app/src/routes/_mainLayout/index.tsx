import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const Home = lazyRouteComponent(() => import("@/home/pages/Home"), "Home");

export const Route = createFileRoute("/_mainLayout/")({
  component: Home,
});
