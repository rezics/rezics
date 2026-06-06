import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ExcerptPage = lazyRouteComponent(
  () => import("@/excerpt/pages/ExcerptPage"),
  "ExcerptPage",
);

export const Route = createFileRoute("/_mainLayout/excerpt/$unitId/")({
  component: ExcerptPage,
});
