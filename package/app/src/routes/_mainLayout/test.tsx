import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const TestPage = lazyRouteComponent(() => import("@/playground/pages/TestPage"));

export const Route = createFileRoute("/_mainLayout/test")({
  component: TestPage,
});
