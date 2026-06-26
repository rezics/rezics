"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const redirectingRef = useRef(false);
  const status = useAuthSessionStore((state) => state.status);
  const role = useAuthSessionStore((state) => state.auth.role);
  const permission = useAuthSessionStore((state) => state.rezics.permission);

  const redirectToLogin = useCallback(() => {
    if (redirectingRef.current) return;
    redirectingRef.current = true;

    const search = searchParams.toString();
    const redirect = buildCurrentRedirectPath({
      pathname,
      searchStr: search ? `?${search}` : "",
      hash: window.location.hash,
    });
    clearAuthSessionState();

    const params = new URLSearchParams({ redirect });
    router.replace(`/admin/login?${params.toString()}`);
  }, [pathname, router, searchParams]);

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
