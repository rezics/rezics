import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const ContinueThreadPage = lazyRouteComponent(
  () => import("@/comment/pages/ContinueThreadPage"),
  "ContinueThreadPage",
);

export const Route = createFileRoute(
  "/_mainLayout/post/$rootPostUnitId/continue/$unitId",
)({
  component: ContinueThreadPage,
});
