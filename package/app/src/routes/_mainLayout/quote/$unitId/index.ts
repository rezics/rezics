import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const QuotePage = lazyRouteComponent(
  () => import("@/quote/pages/QuotePage"),
  "QuotePage",
);

export const Route = createFileRoute("/_mainLayout/quote/$unitId/")({
  component: QuotePage,
});
