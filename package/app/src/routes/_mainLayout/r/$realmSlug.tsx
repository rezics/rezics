import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_mainLayout/r/$realmSlug")({
  component: Outlet,
});
