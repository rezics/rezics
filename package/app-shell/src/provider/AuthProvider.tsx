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
  ensureAuthIdentityToken,
} from '@package/api/react-query/jwt';
import {authApi} from '@package/api/auth/auth.api';
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

  const syncDerivedTokenState = useCallback(() => {
    useAuthStore.getState().syncFromStorage();
    useAuthSessionStore
      .getState()
      .syncAuthContext(getToken(NormalizedTokenName.AUTH_CONTEXT));
    useAuthSessionStore
      .getState()
      .syncBusinessToken(getToken(NormalizedTokenName.REZICS_SESSION));
  }, []);

  const clearMemberTokenState = useCallback(() => {
    removeToken(NormalizedTokenName.AUTH_CONTEXT);
    removeToken(NormalizedTokenName.REZICS_SESSION);
    useAuthSessionStore.getState().syncAuthContext(null);
    useAuthSessionStore.getState().syncBusinessToken(null);
    clearAuthSessionState();
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
          syncDerivedTokenState();

          let authToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
          let authContextToken = getToken(NormalizedTokenName.AUTH_CONTEXT);
          let sessionToken = getToken(NormalizedTokenName.REZICS_SESSION);

          if (!authToken) {
            if (!hasAuthPresence()) {
              clearMemberTokenState();
            }
            try {
              authToken = await ensureAuthIdentityToken({requirePresence: true});
              syncDerivedTokenState();
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
          const authContextPayload = parseJwt(authContextToken);
          const authContextExpMs = authContextPayload?.exp
            ? authContextPayload.exp * 1000
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
          const authContextRefreshInMs = authContextExpMs
            ? authContextExpMs - REFRESH_BUFFER_MS - now
            : 0;

          const nextDelayMs = [
            authRefreshInMs,
            authContextRefreshInMs,
            sessionRefreshInMs,
          ]
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
              syncDerivedTokenState();
            }

            if (authContextRefreshInMs <= 0 || !authContextToken) {
              authContextToken = (await authApi.getContextToken()).token;
              setToken(authContextToken, NormalizedTokenName.AUTH_CONTEXT);
              useAuthSessionStore.getState().syncAuthContext(authContextToken);
            }

            const sessionState = await hydrateAuthSessionState({
              requirePresence: false,
            });
            const authContextClaims = parseJwt(authContextToken);
            if (authContextClaims?.verificationStatus === 'pending') {
              removeToken(NormalizedTokenName.REZICS_SESSION);
              useAuthSessionStore.getState().syncBusinessToken(null);
              refreshRetryPolicy.reset();
              if (isMountedRef.current) {
                scheduleRefresh();
              }
              return;
            }
            sessionToken = getToken(NormalizedTokenName.REZICS_SESSION);
            const refreshedSessionPayload = parseJwt(sessionToken);
            const refreshedSessionExpMs = refreshedSessionPayload?.exp
              ? refreshedSessionPayload.exp * 1000
              : undefined;
            const shouldRefreshSession =
              Boolean(sessionState?.authSession.canAcquireMemberToken) &&
              (!sessionToken ||
                !refreshedSessionExpMs ||
                refreshedSessionExpMs - REFRESH_BUFFER_MS - Date.now() <= 0);

            if (shouldRefreshSession) {
              await userApi.ensure();
              const refreshedSession = await userApi.issueSessionToken();
              if (refreshedSession.token) {
                setToken(refreshedSession.token, NormalizedTokenName.REZICS_SESSION);
                useAuthSessionStore
                  .getState()
                  .syncBusinessToken(refreshedSession.token);
              }
            }

            refreshRetryPolicy.reset();
          } catch {
            clearAuthPresence();
            clearAllTokens();
            useAuthStore.getState().syncFromStorage();
            useAuthSessionStore.getState().syncAuthContext(null);
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
    [clearMemberTokenState, clearRefreshTimer, syncDerivedTokenState],
  );

  useEffect(() => {
    isMountedRef.current = true;
    const retryPolicy = refreshRetryPolicyRef.current;
    retryPolicy.reset();
    useAuthStore.getState().init();
    syncDerivedTokenState();

    function handleStorageChange(event: StorageEvent) {
      const strategy = getJwtTokenStrategy();
      if (!Object.values(strategy.storeKeyByToken).includes(event.key ?? '')) {
        return;
      }
      handleTokenChange(event);
    }

    const handleTokenChange = async (event?: Event) => {
      retryPolicy.reset();
      syncDerivedTokenState();

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
        clearMemberTokenState();
        return;
      }

      if (!authToken) {
        try {
          await ensureAuthIdentityToken({requirePresence: true});
          syncDerivedTokenState();
        } catch {
          clearMemberTokenState();
          return;
        }
      }

      try {
        const authContextToken = (await authApi.getContextToken()).token;
        setToken(authContextToken, NormalizedTokenName.AUTH_CONTEXT);
        useAuthSessionStore.getState().syncAuthContext(authContextToken);

        const sessionState = await hydrateAuthSessionState({requirePresence: false});
        if (
          parseJwt(authContextToken)?.verificationStatus !== 'pending' &&
          sessionState?.authSession.canAcquireMemberToken
        ) {
          await userApi.ensure();
          const sessionTokenResponse = await userApi.issueSessionToken();
          setToken(sessionTokenResponse.token, NormalizedTokenName.REZICS_SESSION);
          useAuthSessionStore
            .getState()
            .syncBusinessToken(sessionTokenResponse.token);
        } else {
          removeToken(NormalizedTokenName.REZICS_SESSION);
          useAuthSessionStore.getState().syncBusinessToken(null);
        }
      } catch {
        clearAuthPresence();
        clearAllTokens();
        useAuthStore.getState().syncFromStorage();
        useAuthSessionStore.getState().syncAuthContext(null);
        clearAuthSessionState();
        return;
      }

      if (authToken || hasAuthPresence()) {
        scheduleRefresh();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const authToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
        if (!authToken && !hasAuthPresence()) {
          clearRefreshTimer();
          clearMemberTokenState();
          return;
        }

        void handleTokenChange();
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
  }, [clearMemberTokenState, clearRefreshTimer, scheduleRefresh, syncDerivedTokenState]);

  return null;
}
