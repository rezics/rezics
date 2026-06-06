import { createFileRoute, lazyRouteComponent } from "@tanstack/react-router";
import { routeBoundaries } from "@/core/routing/routeBoundaries";

const SettingsLibrarySection = lazyRouteComponent(
  () => import("@/user/sections/SettingsLibrarySection"),
  "SettingsLibrarySection",
);

export const Route = createFileRoute("/_mainLayout/user/me/setting/library")({
  component: SettingsLibrarySection,
  ...routeBoundaries(),
});
