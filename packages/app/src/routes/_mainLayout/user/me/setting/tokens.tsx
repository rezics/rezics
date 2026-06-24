import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const SettingsTokensSection = lazyRouteComponent(
  () => import("@/user/sections/SettingsTokensSection"),
  "SettingsTokensSection",
);

export const Route = createFileRoute("/_mainLayout/user/me/setting/tokens")({
  component: SettingsTokensSection,
});
