import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const EchokvPage = lazyRouteComponent(
  () => import("@/misc/pages/EchokvEdit"),
  "EchokvEditPage",
);

export const Route = createFileRoute("/_admin/misc/echokv")({
  component: EchokvPage,
});
