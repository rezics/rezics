import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminAuthGuard } from "@/app/guard/AdminAuthGuard";
import { requireAdminRouteAccess } from "@/app/guard/adminRouteGuards";
import AdminLayout from "@/core/layouts/AdminLayout";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ location }) => {
    await requireAdminRouteAccess(location);
  },
  component: () => (
    <AdminLayout>
      <AdminAuthGuard />
      <Outlet />
    </AdminLayout>
  ),
});
