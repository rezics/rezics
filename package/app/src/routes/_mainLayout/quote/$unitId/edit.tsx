import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const QuoteEditPageContainer = lazyRouteComponent(
  () => import("@/quote/pages/QuoteEditPage"),
  "QuoteEditPageContainer",
);

export const Route = createFileRoute("/_mainLayout/quote/$unitId/edit")({
  component: QuoteEditPageContainer,
});
