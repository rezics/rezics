import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { AdminAuthGuard } from "@/app/guard/AdminAuthGuard";
import {
  buildCurrentRedirectPath,
  isAdminRole,
} from "@/app/guard/adminAuthGuardUtils";
import AdminLayout from "@/core/layouts/AdminLayout";

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ location }) => {
    const store = useAuthSessionStore.getState();

    if (store.status === "idle") {
      await hydrateAuthSessionState({ requirePresence: false });
    }

    const { auth, rezics } = useAuthSessionStore.getState();

    if (rezics.permission && isAdminRole(auth.role)) {
      return;
    }

    throw redirect({
      to: "/login",
      search: { redirect: buildCurrentRedirectPath(location) },
      replace: true,
    });
  },
  component: () => (
    <AdminLayout>
      <AdminAuthGuard />
      <Outlet />
    </AdminLayout>
  ),
});
