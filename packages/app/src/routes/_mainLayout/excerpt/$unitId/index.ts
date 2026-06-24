import { excerptQueries } from "@rezics/api/excerpt/excerpt.queries";
import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeQueryOrNotFound } from "@/core/routing/resourceErrors";

const ExcerptPage = lazyRouteComponent(
  () => import("@/excerpt/pages/ExcerptPage"),
  "ExcerptPage",
);

export const Route = createFileRoute("/_mainLayout/excerpt/$unitId/")({
  loader: async ({ params, context }) => {
    await routeQueryOrNotFound(
      context.qc,
      excerptQueries.detail(params.unitId),
    );
  },
  component: ExcerptPage,
});
