import {useEffect, useMemo} from 'react';
import {isAuthenticated} from '@/api/react-query/http';
import type {UserDTO} from '@package/contract';
import {useQuery} from '@tanstack/react-query';
import {userQueries} from '@/api/user/user.queries';

/**
 * useAuth - Authentication hook
 * Provides current user data and authentication state
 */
export const useAuth = () => {
  const authenticated = isAuthenticated();

  const {data, isLoading, error} = useQuery({
    ...userQueries.me(),
    enabled: authenticated,
  });

  const user = useMemo<UserDTO | null>(() => data ?? null, [data]);

  return {
    user,
    loading: isLoading,
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
