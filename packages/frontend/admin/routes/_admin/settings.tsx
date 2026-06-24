import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_admin/settings")({
  component: lazyRouteComponent(
    () => import("@/admin/setting/pages/SettingsPage"),
    "default",
  ),
});
