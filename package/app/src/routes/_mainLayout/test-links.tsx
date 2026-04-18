import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const TestLinksPage = lazyRouteComponent(
  () => import("@/playground/pages/TestLinksPage"),
);

export const Route = createFileRoute("/_mainLayout/test-links")({
  component: TestLinksPage,
});
