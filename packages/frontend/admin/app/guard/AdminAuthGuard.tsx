import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import {
  clearAuthSessionState,
  useAuthSessionStore,
} from "@/admin/auth/session/authSessionStore";
import {
  buildCurrentRedirectPath,
  isAdminRole,
} from "./adminAuthGuardUtils";

export function AdminAuthGuard() {
  const router = useRouter();
  const redirectingRef = useRef(false);
  const status = useAuthSessionStore((state) => state.status);
  const role = useAuthSessionStore((state) => state.auth.role);
  const permission = useAuthSessionStore((state) => state.rezics.permission);

  const redirectToLogin = useCallback(() => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;

    const redirect = buildCurrentRedirectPath(router.state.location);
    clearAuthSessionState();

    void router.navigate({
      to: "/login",
      search: { redirect },
      replace: true,
    });
  }, [router]);

  useEffect(() => {
    if (status === "error") {
      redirectToLogin();
      return;
    }

    if (status === "ready" && (!permission || !isAdminRole(role))) {
      redirectToLogin();
    }
  }, [permission, redirectToLogin, role, status]);

  return null;
}
