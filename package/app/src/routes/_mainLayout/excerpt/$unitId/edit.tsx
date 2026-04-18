import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ExcerptEditPageContainer = lazyRouteComponent(
  () => import("@/excerpt/pages/ExcerptEditPage"),
  "ExcerptEditPageContainer",
);

export const Route = createFileRoute("/_mainLayout/excerpt/$unitId/edit")({
  component: ExcerptEditPageContainer,
});
