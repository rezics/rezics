import { userQueries } from "@rezics/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useAuthSessionStore, useUserProfileStore } from "@/user/state";

/**
 * useAuth - Authentication hook
 * Derives all state from authSessionStore + userProfileStore.
 */
export const useAuth = () => {
  const authSession = useAuthSessionStore((state) => state.authSession);
  const permission = useAuthSessionStore((state) => state.permission);
  const registrationComplete = useAuthSessionStore(
    (state) => state.registrationComplete,
  );
  const identitySet = useAuthSessionStore((state) => state.identitySet);
  const status = useAuthSessionStore((state) => state.status);
  const user = useUserProfileStore((state) => state.user as UserDTO | null);

  const isAuthenticated = permission !== null;

  const { data, isLoading, error } = useQuery({
    ...userQueries.me(),
    enabled: isAuthenticated && !user,
  });

  const resolvedUser = isAuthenticated ? (user ?? data ?? null) : null;

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
    identitySet,
    registrationComplete,
    readyForApp: isAuthenticated && registrationComplete,
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
