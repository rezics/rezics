import {useCallback, useEffect, useRef} from 'react';
import {
  AUTH_TOKEN_STORAGE_EVENT,
  getToken,
  parseJwt,
  queryAccessToken,
  removeToken,
} from '@package/api/react-query/jwt';
import {
  clearAuthPresence,
  hasAuthPresence,
} from '@package/api/react-query/authPresence';
import {AUTH_STORE_KEY, useAuthStore} from '../state/authStore';
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from '../state/authSessionStore';
import {createRefreshRetryPolicy} from './refreshRetryPolicy';

const REFRESH_BUFFER_MS = 60 * 1000;

function isTokenClearedEvent(event?: Event): boolean {
  if (!event) {
    return false;
  }

  if (event instanceof StorageEvent) {
    return event.key === AUTH_STORE_KEY && event.newValue === null;
  }

  if ('detail' in event) {
    const customEvent = event as CustomEvent<{token?: string | null}>;
    return customEvent.detail?.token === null;
  }

  return false;
}

export function AuthProvider() {
  const refreshTimeoutRef = useRef<number | null>(null);
  const isMountedRef = useRef(true);
  const isRefreshingRef = useRef(false);
  const refreshRetryPolicyRef = useRef(createRefreshRetryPolicy());

  const clearRefreshTimer = useCallback(() => {
    if (refreshTimeoutRef.current !== null) {
      window.clearTimeout(refreshTimeoutRef.current);
      refreshTimeoutRef.current = null;
    }
  }, []);

  const scheduleRefresh = useCallback(
    (delayMs = 0) => {
      clearRefreshTimer();

      refreshTimeoutRef.current = window.setTimeout(
        async () => {
          if (!isMountedRef.current || isRefreshingRef.current) {
            return;
          }

          const refreshRetryPolicy = refreshRetryPolicyRef.current;
          useAuthStore.getState().syncFromStorage();
          const token = getToken();
          if (!token) {
            if (!hasAuthPresence()) {
              clearAuthSessionState();
            }
            refreshRetryPolicy.reset();
            clearRefreshTimer();
            return;
          }

          const payload = parseJwt(token);
          const expSeconds = payload?.exp;

          if (!expSeconds) {
            refreshRetryPolicy.reset();
            useAuthStore.getState().clearAuth();
            return;
          }

          const expMs = expSeconds * 1000;
          const msUntilRefresh = expMs - REFRESH_BUFFER_MS - Date.now();

          if (msUntilRefresh > 0) {
            scheduleRefresh(msUntilRefresh);
            return;
          }

          isRefreshingRef.current = true;

          try {
            await queryAccessToken();
            refreshRetryPolicy.reset();
            useAuthStore.getState().syncFromStorage();
            await hydrateAuthSessionState();
          } catch {
            clearAuthPresence();
            removeToken();
            clearAuthSessionState();
            const retryDelayMs = refreshRetryPolicy.registerFailure();
            if (isMountedRef.current) {
              scheduleRefresh(retryDelayMs);
            }
            return;
          } finally {
            isRefreshingRef.current = false;
          }

          if (isMountedRef.current) {
            scheduleRefresh();
          }
        },
        Math.max(0, delayMs),
      );
    },
    [clearRefreshTimer],
  );

  useEffect(() => {
    isMountedRef.current = true;
    const retryPolicy = refreshRetryPolicyRef.current;
    retryPolicy.reset();
    useAuthStore.getState().init();
    useAuthSessionStore.getState().syncBusinessToken(getToken());

    function handleStorageChange(event: StorageEvent) {
      if (event.key !== AUTH_STORE_KEY) {
        return;
      }
      handleTokenChange(event);
    }

    const handleTokenChange = async (event?: Event) => {
      retryPolicy.reset();
      useAuthStore.getState().syncFromStorage();
      useAuthSessionStore.getState().syncBusinessToken(getToken());

      if (isTokenClearedEvent(event)) {
        clearRefreshTimer();
        if (!hasAuthPresence()) {
          clearAuthSessionState();
        }
        return;
      }

      const token = getToken();
      if (!token && !hasAuthPresence()) {
        clearRefreshTimer();
        clearAuthSessionState();
        return;
      }

      await hydrateAuthSessionState({requirePresence: !token});
      if (token || hasAuthPresence()) {
        scheduleRefresh();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const token = getToken();
        if (!token && !hasAuthPresence()) {
          clearRefreshTimer();
          clearAuthSessionState();
          return;
        }

        void hydrateAuthSessionState({requirePresence: !token});
        scheduleRefresh();
      }
    };

    void handleTokenChange();

    window.addEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenChange);
    window.addEventListener('storage', handleStorageChange);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMountedRef.current = false;
      retryPolicy.reset();
      clearRefreshTimer();
      window.removeEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenChange);
      window.removeEventListener('storage', handleStorageChange);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [clearRefreshTimer, scheduleRefresh]);

  return null;
}
