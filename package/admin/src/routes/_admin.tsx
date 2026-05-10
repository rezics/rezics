import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import AdminLayout from "@/core/layouts/AdminLayout";

function resolveAttemptedPath(location: any): string {
  if (typeof location?.pathname === "string") {
    return `${location.pathname ?? ""}${location.searchStr ?? ""}${location.hash ?? ""}`;
  }
  if (typeof location?.href === "string") {
    return location.href;
  }
  return "/";
}

function isAdminRole(role: string | null | undefined): boolean {
  return role === "admin" || role === "owner";
}

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
      search: { redirect: resolveAttemptedPath(location) },
      replace: true,
    });
  },
  component: () => (
    <AdminLayout>
      <Outlet />
    </AdminLayout>
  ),
});
