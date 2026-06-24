import { createFileRoute, Outlet } from "@tanstack/react-router";
import { AdminAuthGuard } from "@/admin/app/guard/AdminAuthGuard";
import { requireAdminRouteAccess } from "@/admin/app/guard/adminRouteGuards";
import AdminLayout from "@/admin/core/layouts/AdminLayout";

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
