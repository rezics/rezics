import {
  clearAuthSessionState,
  useAuthSessionStore,
} from "@rezics/contract/api/states";
import { useRouter } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { qc } from "@/admin/app/providers/reactQueryUtil";
import {
  buildCurrentRedirectPath,
  isAdminRole,
  isUnauthorizedError,
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

  useEffect(() => {
    const handleError = (error: unknown) => {
      if (isUnauthorizedError(error)) {
        redirectToLogin();
      }
    };

    const unsubscribeQueries = qc.getQueryCache().subscribe((event) => {
      if (event.type !== "updated") return;
      handleError(event.query.state.error);
    });

    const unsubscribeMutations = qc.getMutationCache().subscribe((event) => {
      if (event.type !== "updated") return;
      handleError(event.mutation.state.error);
    });

    for (const query of qc.getQueryCache().findAll()) {
      handleError(query.state.error);
    }

    for (const mutation of qc.getMutationCache().getAll()) {
      handleError(mutation.state.error);
    }

    return () => {
      unsubscribeQueries();
      unsubscribeMutations();
    };
  }, [redirectToLogin]);

  return null;
}
