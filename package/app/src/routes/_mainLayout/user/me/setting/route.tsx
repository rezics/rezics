import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/user/me/setting")({
  component: lazyRouteComponent(
    () => import("@/user/components/SettingsShell"),
    "SettingsShell",
  ),
});
