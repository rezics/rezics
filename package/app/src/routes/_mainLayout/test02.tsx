import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const TestPage02 = lazyRouteComponent(
  () => import("@/playground/page/TestPage02"),
  "TestPage02",
);

export const Route = createFileRoute("/_mainLayout/test02")({
  component: TestPage02,
});
