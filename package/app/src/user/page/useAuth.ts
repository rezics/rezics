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
  const capabilityLevel = useAuthSessionStore((state) => state.capabilityLevel);
  const hasAuthSession = useAuthSessionStore((state) => state.hasAuthSession);
  const hasBusinessToken = useAuthSessionStore(
    (state) => state.hasBusinessToken,
  );
  const needsOnboarding = useAuthSessionStore((state) => state.needsOnboarding);
  const needsVerification = useAuthSessionStore(
    (state) => state.needsVerification,
  );
  const status = useAuthSessionStore((state) => state.status);
  const user = useUserProfileStore((state) => state.user as UserDTO | null);
  const setUser = useUserProfileStore((state) => state.setUser);

  const { data, isLoading, error } = useQuery({
    ...userQueries.me(),
    enabled: capabilityLevel === "member" && !user,
  });

  const resolvedUser =
    capabilityLevel === "member" ? (user ?? data ?? null) : null;

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
      (capabilityLevel === "member" && !resolvedUser ? isLoading : false),
    error: error ? (error as Error).message : undefined,
    authenticated: hasAuthSession,
    isAuthenticated: hasAuthSession,
    hasAuthSession,
    hasBusinessToken,
    needsOnboarding,
    needsVerification,
    capabilityLevel,
    readyForApp:
      hasAuthSession &&
      !needsOnboarding &&
      !needsVerification &&
      hasBusinessToken,
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
