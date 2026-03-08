import {useEffect} from 'react';
import type {UserDTO} from '@package/contract';
import {useQuery} from '@tanstack/react-query';
import {userQueries} from '@package/api/user/user.queries';
import {useAuthStore, useUserProfileStore} from '@/user/state';

/**
 * useAuth - Authentication hook
 * Provides current user data and authentication state
 */
export const useAuth = () => {
  const authenticated = useAuthStore(state => state.isAuthenticated);
  const user = useUserProfileStore(state => state.user as UserDTO | null);
  const setUser = useUserProfileStore(state => state.setUser);

  const {data, isLoading, error} = useQuery({
    ...userQueries.me(),
    enabled: authenticated && !user,
  });

  useEffect(() => {
    if (data) {
      setUser(data);
    }
  }, [data, setUser]);

  return {
    user: user ?? data ?? null,
    loading: authenticated && !(user ?? data) ? isLoading : false,
    error: error ? (error as Error).message : undefined,
    authenticated,
    isAuthenticated: authenticated,
  };
};

/**
 * useRequireAuth - Redirect to login if not authenticated
 * Returns auth state or redirects to login
 */
export const useRequireAuth = (redirectTo = '/login') => {
  const auth = useAuth();

  useEffect(() => {
    if (!auth.loading && !auth.authenticated) {
      window.location.href = redirectTo;
    }
  }, [auth.loading, auth.authenticated, redirectTo]);

  return auth;
};
