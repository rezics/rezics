import {useCallback, useEffect, useRef} from 'react';
import {
  AUTH_TOKEN_STORAGE_EVENT,
  clearAllTokens,
  getToken,
  getJwtTokenStrategy,
  setToken,
  parseJwt,
  queryAccessToken,
  removeToken,
} from '@package/api/react-query/jwt';
import {NormalizedTokenName} from '@package/contract';
import {userApi} from '@package/api/user/user.api';
import {
  clearAuthPresence,
  hasAuthPresence,
} from '@package/api/react-query/authPresence';
import {useAuthStore} from '../state/authStore';
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
    const strategy = getJwtTokenStrategy();
    return (
      Object.values(strategy.storeKeyByToken).includes(event.key ?? '') &&
      event.newValue === null
    );
  }

  if ('detail' in event) {
    const customEvent = event as CustomEvent<{
      token?: string | null;
      tokenName?: string;
    }>;
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
          useAuthSessionStore
            .getState()
            .syncBusinessToken(getToken(NormalizedTokenName.REZICS_SESSION));

          let authToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
          let sessionToken = getToken(NormalizedTokenName.REZICS_SESSION);

          if (!authToken) {
            if (!hasAuthPresence()) {
              removeToken(NormalizedTokenName.REZICS_SESSION);
              clearAuthSessionState();
            }
            try {
              authToken = await queryAccessToken({requirePresence: true});
              useAuthStore.getState().syncFromStorage();
            } catch {
              refreshRetryPolicy.reset();
              clearRefreshTimer();
              return;
            }
          }

          const authPayload = parseJwt(authToken);
          const authExpMs = authPayload?.exp
            ? authPayload.exp * 1000
            : undefined;
          const sessionPayload = parseJwt(sessionToken);
          const sessionExpMs = sessionPayload?.exp
            ? sessionPayload.exp * 1000
            : undefined;
          const now = Date.now();
          const authRefreshInMs = authExpMs
            ? authExpMs - REFRESH_BUFFER_MS - now
            : 0;
          const sessionRefreshInMs = sessionExpMs
            ? sessionExpMs - REFRESH_BUFFER_MS - now
            : null;

          const nextDelayMs = [authRefreshInMs, sessionRefreshInMs]
            .filter((value): value is number => value !== null && value > 0)
            .sort((left, right) => left - right)[0];

          if (nextDelayMs && nextDelayMs > 0) {
            scheduleRefresh(nextDelayMs);
            return;
          }

          isRefreshingRef.current = true;

          try {
            if (authRefreshInMs <= 0) {
              authToken = await queryAccessToken({requirePresence: true});
              useAuthStore.getState().syncFromStorage();
            }

            const sessionState = await hydrateAuthSessionState({
              requirePresence: false,
            });
            sessionToken = getToken(NormalizedTokenName.REZICS_SESSION);
            const refreshedSessionPayload = parseJwt(sessionToken);
            const refreshedSessionExpMs = refreshedSessionPayload?.exp
              ? refreshedSessionPayload.exp * 1000
              : undefined;
            const shouldRefreshSession =
              Boolean(sessionToken) &&
              Boolean(sessionState?.authSession.canAcquireMemberToken) &&
              (!refreshedSessionExpMs ||
                refreshedSessionExpMs - REFRESH_BUFFER_MS - Date.now() <= 0);

            if (shouldRefreshSession) {
              const refreshedSession = await userApi.refreshSession();
              if (refreshedSession.sessionToken) {
                setToken(
                  refreshedSession.sessionToken,
                  NormalizedTokenName.REZICS_SESSION,
                );
                useAuthSessionStore
                  .getState()
                  .syncBusinessToken(refreshedSession.sessionToken);
              }
            }

            refreshRetryPolicy.reset();
          } catch {
            clearAuthPresence();
            clearAllTokens();
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
    useAuthSessionStore
      .getState()
      .syncBusinessToken(getToken(NormalizedTokenName.REZICS_SESSION));

    function handleStorageChange(event: StorageEvent) {
      const strategy = getJwtTokenStrategy();
      if (!Object.values(strategy.storeKeyByToken).includes(event.key ?? '')) {
        return;
      }
      handleTokenChange(event);
    }

    const handleTokenChange = async (event?: Event) => {
      retryPolicy.reset();
      useAuthStore.getState().syncFromStorage();
      useAuthSessionStore
        .getState()
        .syncBusinessToken(getToken(NormalizedTokenName.REZICS_SESSION));

      if (isTokenClearedEvent(event)) {
        clearRefreshTimer();
        if (!hasAuthPresence()) {
          clearAuthSessionState();
        }
        return;
      }

      const authToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
      if (!authToken && !hasAuthPresence()) {
        clearRefreshTimer();
        removeToken(NormalizedTokenName.REZICS_SESSION);
        clearAuthSessionState();
        return;
      }

      await hydrateAuthSessionState({requirePresence: !authToken});
      if (authToken || hasAuthPresence()) {
        scheduleRefresh();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const authToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
        if (!authToken && !hasAuthPresence()) {
          clearRefreshTimer();
          removeToken(NormalizedTokenName.REZICS_SESSION);
          clearAuthSessionState();
          return;
        }

        void hydrateAuthSessionState({requirePresence: !authToken});
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
