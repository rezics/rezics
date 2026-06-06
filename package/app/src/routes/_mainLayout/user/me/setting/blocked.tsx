import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const SettingsBlockedSection = lazyRouteComponent(
  () => import("@/user/sections/SettingsBlockedSection"),
  "SettingsBlockedSection",
);

export const Route = createFileRoute("/_mainLayout/user/me/setting/blocked")({
  component: SettingsBlockedSection,
});
