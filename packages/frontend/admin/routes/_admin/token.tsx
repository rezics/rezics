import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const TokenPage = lazyRouteComponent(
  () => import("@/admin/token/pages/TokenPage"),
  "TokenPage",
);

export const Route = createFileRoute("/_admin/token")({
  component: TokenPage,
});
