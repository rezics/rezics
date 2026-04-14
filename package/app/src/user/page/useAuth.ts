import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useAuthSessionStore, useUserProfileStore } from "@/user/state";

/**
 * useAuth - Authentication hook
 * Derives all state from authSessionStore + userProfileStore.
 */
export const useAuth = () => {
  const authSession = useAuthSessionStore((state) => state.authSession);
  const permission = useAuthSessionStore((state) => state.permission);
  const needsOnboarding = useAuthSessionStore((state) => state.needsOnboarding);
  const needsVerification = useAuthSessionStore(
    (state) => state.needsVerification,
  );
  const status = useAuthSessionStore((state) => state.status);
  const user = useUserProfileStore((state) => state.user as UserDTO | null);
  const setUser = useUserProfileStore((state) => state.setUser);

  const isAuthenticated = permission !== null;

  const { data, isLoading, error } = useQuery({
    ...userQueries.me(),
    enabled: isAuthenticated && !user,
  });

  const resolvedUser = isAuthenticated ? (user ?? data ?? null) : null;

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

  return {
    user: resolvedUser,
    authSession,
    loading:
      status === "loading" ||
      (isAuthenticated && !resolvedUser ? isLoading : false),
    error: error ? (error as Error).message : undefined,
    authenticated: isAuthenticated,
    isAuthenticated,
    permission,
    needsOnboarding,
    needsVerification,
    readyForApp: isAuthenticated && !needsOnboarding && !needsVerification,
  };
};

/**
 * useRequireAuth - Redirect to login if not authenticated
 * Returns auth state or redirects to login
 */
export const useRequireAuth = (redirectTo = "/login") => {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.readyForApp) {
      window.location.href = redirectTo;
    }
  }, [auth.loading, auth.readyForApp, redirectTo]);

  return auth;
};
