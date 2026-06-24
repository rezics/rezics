import { userQueries } from "@rezics/contract/api/user/user.queries";
import type { UserDTO } from "@rezics/contract";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import {
  selectCanFetchUserProfile,
  selectHasAuthIdentity,
  selectHasMemberSession,
  selectRegistrationStage,
  useAuthSessionStore,
  useUserProfileStore,
} from "@/user/states";

/**
 * useAuth - Authentication hook
 * Derives all state from authSessionStore + userProfileStore.
 */
export const useAuth = () => {
  const authAccountState = useAuthSessionStore(
    (state) => state.authAccountState,
  );
  const permission = useAuthSessionStore((state) => state.rezics.permission);
  const registrationComplete = useAuthSessionStore(
    (state) => state.registration.complete,
  );
  const mainUserExists = useAuthSessionStore(
    (state) => state.rezics.mainUserExists,
  );
  const needsVerification = useAuthSessionStore(
    (state) => state.registration.needsVerification,
  );
  const needsMainSetup = useAuthSessionStore(
    (state) => state.registration.needsMainSetup,
  );
  const status = useAuthSessionStore((state) => state.status);
  const hasAuthIdentity = useAuthSessionStore(selectHasAuthIdentity);
  const hasMemberSession = useAuthSessionStore(selectHasMemberSession);
  const registrationStage = useAuthSessionStore(selectRegistrationStage);
  const canFetchUserProfile = useAuthSessionStore(selectCanFetchUserProfile);
  const user = useUserProfileStore((state) => state.user as UserDTO | null);

  const isAuthenticated = hasAuthIdentity;

  const { data, isLoading, error } = useQuery({
    ...userQueries.me(),
    enabled: canFetchUserProfile && !user,
  });

  const resolvedUser = canFetchUserProfile ? (user ?? data ?? null) : null;

  return {
    user: resolvedUser,
    authAccountState,
    loading:
      status === "loading" ||
      (canFetchUserProfile && !resolvedUser ? isLoading : false),
    error: error ? (error as Error).message : undefined,
    authenticated: isAuthenticated,
    isAuthenticated,
    hasAuthIdentity,
    hasMemberSession,
    registrationStage,
    permission,
    mainUserExists,
    needsVerification,
    needsMainSetup,
    registrationComplete,
    readyForApp: hasMemberSession && registrationComplete,
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
