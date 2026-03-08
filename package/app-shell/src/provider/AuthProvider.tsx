import {useCallback, useEffect, useRef} from 'react';
import {
  AUTH_TOKEN_STORAGE_EVENT,
  getToken,
  parseJwt,
  refreshAuthToken,
} from '@package/api/react-query/http';
import {useAuthStore} from '../state/authStore';

const REFRESH_BUFFER_MS = 60 * 1000;

export function AuthProvider() {
  const refreshTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(async () => {
    clearRefreshTimer();
    useAuthStore.getState().syncFromStorage();

    const token = getToken();
    if (!token) {
      try {
        await refreshAuthToken();
        useAuthStore.getState().syncFromStorage();
      } catch {
        useAuthStore.getState().clearAuth();
        return;
      }

      if (isMountedRef.current) {
        void scheduleRefresh();
      }
      return;
    }

    const payload = parseJwt(token);
    const expSeconds = payload?.exp;
    if (!expSeconds) {
      useAuthStore.getState().clearAuth();
      return;
    }

    const expMs = expSeconds * 1000;
    const msUntilRefresh = expMs - REFRESH_BUFFER_MS - Date.now();

    if (msUntilRefresh <= 0) {
      try {
        await refreshAuthToken();
        useAuthStore.getState().syncFromStorage();
      } catch {
        useAuthStore.getState().clearAuth();
        return;
      }

      if (isMountedRef.current) {
        void scheduleRefresh();
      }
      return;
    }

    refreshTimeoutRef.current = window.setTimeout(async () => {
      try {
        await refreshAuthToken();
        useAuthStore.getState().syncFromStorage();
      } catch {
        useAuthStore.getState().clearAuth();
        return;
      }

      if (isMountedRef.current) {
        void scheduleRefresh();
      }
    }, msUntilRefresh);
  }, [clearRefreshTimer]);

  useEffect(() => {
    isMountedRef.current = true;
    useAuthStore.getState().init();

    const handleTokenChange = () => {
      useAuthStore.getState().syncFromStorage();
      void scheduleRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void scheduleRefresh();
      }
    };

    void scheduleRefresh();

    window.addEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenChange);
    window.addEventListener('storage', handleTokenChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      clearRefreshTimer();
      window.removeEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenChange);
      window.removeEventListener('storage', handleTokenChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearRefreshTimer, scheduleRefresh]);

  return null;
}
