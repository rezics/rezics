import {useEffect} from 'react';
import type {UserDTO} from '@package/contract';
import {useQuery} from '@tanstack/react-query';
import {userQueries} from '@package/api/user/user.queries';
import {useAuthSessionStore, useAuthStore, useUserProfileStore} from '@/user/state';

/**
 * useAuth - Authentication hook
 * Provides current user data and authentication state
 */
export const useAuth = () => {
  const hasIdentityToken = useAuthStore(state => state.isAuthenticated);
  const authSession = useAuthSessionStore(state => state.authSession);
  const capabilityLevel = useAuthSessionStore(state => state.capabilityLevel);
  const hasAuthSession = useAuthSessionStore(state => state.hasAuthSession);
  const needsOnboarding = useAuthSessionStore(state => state.needsOnboarding);
  const needsVerification = useAuthSessionStore(state => state.needsVerification);
  const status = useAuthSessionStore(state => state.status);
  const user = useUserProfileStore(state => state.user as UserDTO | null);
  const setUser = useUserProfileStore(state => state.setUser);

  const {data, isLoading, error} = useQuery({
    ...userQueries.me(),
    enabled: capabilityLevel === 'member' && !user,
  });

  const resolvedUser = capabilityLevel === 'member' ? (user ?? data ?? null) : null;

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

  return {
    user: resolvedUser,
    authSession,
    loading:
      status === 'loading' ||
      (capabilityLevel === 'member' && !resolvedUser ? isLoading : false),
    error: error ? (error as Error).message : undefined,
    authenticated: hasIdentityToken || hasAuthSession,
    isAuthenticated: hasIdentityToken,
    hasAuthSession,
    hasBusinessToken: capabilityLevel === 'member',
    needsOnboarding,
    needsVerification,
    capabilityLevel,
    readyForApp:
      hasAuthSession &&
      !needsOnboarding &&
      !needsVerification &&
      capabilityLevel === 'member',
  };
};

/**
 * useRequireAuth - Redirect to login if not authenticated
 * Returns auth state or redirects to login
 */
export const useRequireAuth = (redirectTo = '/login') => {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.readyForApp) {
      window.location.href = redirectTo;
    }
  }, [auth.loading, auth.readyForApp, redirectTo]);

  return auth;
};
