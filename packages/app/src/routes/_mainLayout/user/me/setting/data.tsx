import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";

const SettingsDataSection = lazyRouteComponent(
  () => import("@/user/sections/SettingsDataSection"),
  "SettingsDataSection",
);

export const Route = createFileRoute("/_mainLayout/user/me/setting/data")({
  component: SettingsDataSection,
});
