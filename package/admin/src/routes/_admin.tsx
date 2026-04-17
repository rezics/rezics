import { getToken, parseJwt } from "@rezics/api/react-query/jwt";
import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import { NormalizedTokenName } from "@rezics/contract";
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

function isAdminRole(token: string | null): boolean {
  if (!token) return false;
  const claims = parseJwt(token);
  return claims?.role === "admin" || claims?.role === "owner";
}

export const Route = createFileRoute("/_admin")({
  beforeLoad: async ({ location }) => {
    const token = getToken(NormalizedTokenName.AUTH_SESSION);
    const store = useAuthSessionStore.getState();

    if (store.status === "idle" && token) {
      await hydrateAuthSessionState();
    }

    const { permission } = useAuthSessionStore.getState();

    if (permission && isAdminRole(token)) {
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
