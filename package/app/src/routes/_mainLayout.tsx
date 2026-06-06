import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from "@tanstack/react-router";

const MainLayout = lazyRouteComponent(
  () => import("@/core/layouts/MainLayout"),
  "MainLayout",
);

export const Route = createFileRoute("/_mainLayout")({
  component: () => (
    <MainLayout>
      <Outlet />
    </MainLayout>
  ),
});
