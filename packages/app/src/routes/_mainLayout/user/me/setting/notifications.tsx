import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const SettingsNotificationsSection = lazyRouteComponent(
  () => import("@/user/sections/SettingsNotificationsSection"),
  "SettingsNotificationsSection",
);

export const Route = createFileRoute(
  "/_mainLayout/user/me/setting/notifications",
)({
  component: SettingsNotificationsSection,
});
