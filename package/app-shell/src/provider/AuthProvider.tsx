import {useEffect, useRef} from 'react';
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
import {
  NormalizedTokenName,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@package/contract';
import {userApi} from '@package/api/user/user.api';
import {
  clearAuthPresence,
  hasAuthPresence,
} from '@package/api/react-query/authPresence';
import {
  clearAuthSessionState,
  useAuthSessionStore,
} from '../state/authSessionStore';
import {createRefreshRetryPolicy} from './refreshRetryPolicy';

const REFRESH_BUFFER_MS = 60 * 1000;

type TokenState = 'idle' | 'managing' | 'dormant';

type TokenSlot = {
  tokenName: NormalizedTokenNameType;
  state: TokenState;
  retryPolicy: ReturnType<typeof createRefreshRetryPolicy>;
};

function getTokenExpMs(tokenName: NormalizedTokenNameType): number | null {
  const token = getToken(tokenName);
  if (!token) return null;
  const payload = parseJwt(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

function isTokenExpiredOrMissing(tokenName: NormalizedTokenNameType): boolean {
  const expMs = getTokenExpMs(tokenName);
  if (!expMs) return true;
  return expMs - REFRESH_BUFFER_MS <= Date.now();
}

async function refreshToken(
  tokenName: NormalizedTokenNameType,
): Promise<'success' | 'retryable' | 'non-retryable'> {
  try {
    switch (tokenName) {
      case NormalizedTokenName.AUTH_IDENTITY: {
        const token = await queryAccessToken({requirePresence: true});
        if (!token) return 'non-retryable';
        return 'success';
      }
      case NormalizedTokenName.REZICS_SESSION: {
        const response = await userApi.issueSessionToken();
        if (response.token) {
          setToken(response.token, NormalizedTokenName.REZICS_SESSION);
          useAuthSessionStore.getState().syncBusinessToken(response.token);
          return 'success';
        }
        return 'retryable';
      }
      default: {
        return 'non-retryable';
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const isNonRetryable =
      message.includes('not found') ||
      message.includes('Unauthorized') ||
      message.includes('Forbidden') ||
      message.includes('403') ||
      message.includes('404');
    return isNonRetryable ? 'non-retryable' : 'retryable';
  }
}

export type AuthProviderProps = {
  tokens: NormalizedTokenNameType[];
};

export function AuthProvider({tokens}: AuthProviderProps) {
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;

  useEffect(() => {
    let mounted = true;
    let refreshTimeout: number | null = null;

    const slots: TokenSlot[] = tokens.map(tokenName => ({
      tokenName,
      state: 'idle' as TokenState,
      retryPolicy: createRefreshRetryPolicy(),
    }));

    function clearTimer() {
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
    }

    function getSlot(tokenName: NormalizedTokenNameType): TokenSlot | undefined {
      return slots.find(s => s.tokenName === tokenName);
    }

    function handleAuthSessionExpired() {
      clearTimer();
      clearAuthPresence();
      clearAllTokens();
      clearAuthSessionState();
      useAuthSessionStore.getState().syncBusinessToken(null);
    }

    async function runRefreshCycle() {
      if (!mounted) return;

      for (const slot of slots) {
        if (!mounted) return;

        if (slot.state === 'dormant') continue;

        const token = getToken(slot.tokenName);
        const expMs = token ? getTokenExpMs(slot.tokenName) : null;
        const needsRefresh = !token || !expMs || expMs - REFRESH_BUFFER_MS <= Date.now();

        if (!needsRefresh) {
          slot.state = 'managing';
          continue;
        }

        // For AUTH_IDENTITY: if no auth presence, stop the chain
        if (
          slot.tokenName === NormalizedTokenName.AUTH_IDENTITY &&
          !hasAuthPresence() &&
          !token
        ) {
          handleAuthSessionExpired();
          return;
        }

        const result = await refreshToken(slot.tokenName);

        switch (result) {
          case 'success':
            slot.state = 'managing';
            slot.retryPolicy.reset();
            break;

          case 'non-retryable':
            if (slot.tokenName === NormalizedTokenName.AUTH_IDENTITY) {
              handleAuthSessionExpired();
              return;
            }
            slot.state = 'dormant';
            // Dormant: skip downstream tokens
            break;

          case 'retryable': {
            const delayMs = slot.retryPolicy.registerFailure();
            scheduleRefresh(delayMs);
            return; // Stop chain, retry later
          }
        }

        // If this token went dormant, skip downstream tokens
        if (slot.state === 'dormant') break;
      }

      // Schedule next refresh based on earliest expiry
      const nextRefreshMs = computeNextRefreshDelay();
      if (nextRefreshMs !== null && mounted) {
        scheduleRefresh(nextRefreshMs);
      }
    }

    function computeNextRefreshDelay(): number | null {
      const now = Date.now();
      let earliest: number | null = null;

      for (const slot of slots) {
        if (slot.state !== 'managing') continue;
        const expMs = getTokenExpMs(slot.tokenName);
        if (!expMs) continue;
        const refreshAt = expMs - REFRESH_BUFFER_MS;
        const delay = refreshAt - now;
        if (delay > 0 && (earliest === null || delay < earliest)) {
          earliest = delay;
        }
      }

      return earliest;
    }

    function scheduleRefresh(delayMs = 0) {
      clearTimer();
      refreshTimeout = window.setTimeout(
        () => void runRefreshCycle(),
        Math.max(0, delayMs),
      );
    }

    // Token storage event handler (same-tab)
    function handleTokenStorageEvent(event: Event) {
      if (!mounted) return;

      const customEvent = event as CustomEvent<{
        token?: string | null;
        tokenName?: string;
      }>;
      const detail = customEvent.detail;

      if (!detail?.tokenName) return;

      const slot = getSlot(detail.tokenName as NormalizedTokenNameType);
      if (!slot) return;

      if (detail.token === null) {
        // Token was cleared
        if (slot.tokenName === NormalizedTokenName.AUTH_IDENTITY) {
          if (!hasAuthPresence()) {
            handleAuthSessionExpired();
          }
        }
        return;
      }

      // Token was written - reactivate if dormant
      if (slot.state === 'dormant') {
        slot.state = 'idle';
        slot.retryPolicy.reset();
        scheduleRefresh();
      }
    }

    // Cross-tab storage event handler
    function handleStorageEvent(event: StorageEvent) {
      if (!mounted) return;

      const strategy = getJwtTokenStrategy();
      if (!Object.values(strategy.storeKeyByToken).includes(event.key ?? '')) {
        return;
      }

      if (event.newValue !== null) {
        // Token was written in another tab - reactivate dormant slots
        for (const slot of slots) {
          if (slot.state === 'dormant') {
            const token = getToken(slot.tokenName);
            if (token) {
              slot.state = 'idle';
              slot.retryPolicy.reset();
            }
          }
        }
        scheduleRefresh();
      } else {
        // Token was cleared in another tab
        const identitySlot = getSlot(NormalizedTokenName.AUTH_IDENTITY);
        if (identitySlot && !getToken(NormalizedTokenName.AUTH_IDENTITY) && !hasAuthPresence()) {
          handleAuthSessionExpired();
        }
      }
    }

    // Visibility change handler
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (!mounted) return;

      // Check all managed tokens and refresh expired ones
      const needsRefresh = slots.some(
        slot =>
          slot.state === 'managing' && isTokenExpiredOrMissing(slot.tokenName),
      );

      if (needsRefresh) {
        scheduleRefresh();
      }
    }

    // Initial refresh cycle
    scheduleRefresh();

    window.addEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenStorageEvent);
    window.addEventListener('storage', handleStorageEvent);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimer();
      window.removeEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenStorageEvent);
      window.removeEventListener('storage', handleStorageEvent);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [tokens]);

  return null;
}
