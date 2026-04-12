import { getToken, parseJwt } from "@rezics/api/react-query/jwt";
import {
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/app-shell";
import { NormalizedTokenName } from "@rezics/contract";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import AdminLayout from "@/core/layout/AdminLayout";
import { establishBusinessSession } from "@/user/model/handler";

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
    const token = getToken(NormalizedTokenName.AUTH_IDENTITY);
    const store = useAuthSessionStore.getState();

    // Fresh page load: hydrate session state from server
    if (store.status === "idle" && token) {
      await hydrateAuthSessionState();
      await establishBusinessSession();
    }

    const { hasAuthSession } = useAuthSessionStore.getState();

    if (hasAuthSession && isAdminRole(token)) {
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
