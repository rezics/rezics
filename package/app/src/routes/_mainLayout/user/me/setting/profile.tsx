import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const SettingsProfileSection = lazyRouteComponent(
  () => import("@/user/sections/SettingsProfileSection"),
  "SettingsProfileSection",
);

export const Route = createFileRoute("/_mainLayout/user/me/setting/profile")({
  component: SettingsProfileSection,
});
