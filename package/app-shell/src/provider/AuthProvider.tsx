import {useEffect, useRef} from 'react';
import {
  AUTH_TOKEN_STORAGE_EVENT,
  clearAllTokens,
  getToken,
  getJwtTokenStrategy,
  setToken,
  parseJwt,
  queryAccessToken,
} from '@package/api/react-query/jwt';
import {
  NormalizedTokenName,
  type NormalizedTokenName as NormalizedTokenNameType,
} from '@package/contract';
import type {TokenRefreshRegistry} from '@package/api/react-query/tokenRefreshRegistry';
import {
  clearAuthPresence,
  hasAuthPresence,
} from '@package/api/react-query/authPresence';
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from '../state/authSessionStore';
import {createRefreshRetryPolicy} from './refreshRetryPolicy';

const REFRESH_BUFFER_MS = 60 * 1000;
const DEFAULT_TOKENS = [NormalizedTokenName.AUTH_IDENTITY];

type TokenState = 'idle' | 'managing' | 'dormant' | 'backoff';

type TokenSlot = {
  tokenName: NormalizedTokenNameType;
  state: TokenState;
  retryPolicy: ReturnType<typeof createRefreshRetryPolicy>;
  nextRetryAt: number | null;
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

function classifyError(error: unknown): 'retryable' | 'non-retryable' {
  const message = error instanceof Error ? error.message : '';
  const isNonRetryable =
    message.includes('not found') ||
    message.includes('Unauthorized') ||
    message.includes('Forbidden') ||
    message.includes('403') ||
    message.includes('404');
  return isNonRetryable ? 'non-retryable' : 'retryable';
}

async function refreshGateway(): Promise<'success' | 'retryable' | 'non-retryable'> {
  try {
    const token = await queryAccessToken({requirePresence: true});
    return token ? 'success' : 'non-retryable';
  } catch {
    return 'non-retryable';
  }
}

async function refreshServiceToken(
  slot: TokenSlot,
  registry: TokenRefreshRegistry,
): Promise<void> {
  const refreshFn = registry[slot.tokenName];
  if (!refreshFn) {
    slot.state = 'dormant';
    return;
  }

  try {
    const {token} = await refreshFn();
    if (token) {
      setToken(token, slot.tokenName);
      slot.state = 'managing';
      slot.retryPolicy.reset();
      slot.nextRetryAt = null;
    } else {
      slot.state = 'dormant';
    }
  } catch (error) {
    const classification = classifyError(error);
    if (classification === 'non-retryable') {
      slot.state = 'dormant';
      slot.nextRetryAt = null;
    } else {
      slot.state = 'backoff';
      const delayMs = slot.retryPolicy.registerFailure();
      slot.nextRetryAt = Date.now() + delayMs;
    }
  }
}

export type AuthProviderProps = {
  tokens?: NormalizedTokenNameType[];
  registry?: TokenRefreshRegistry;
};

export function AuthProvider({
  tokens = DEFAULT_TOKENS,
  registry = {},
}: AuthProviderProps) {
  const tokensRef = useRef(tokens);
  tokensRef.current = tokens;
  const registryRef = useRef(registry);
  registryRef.current = registry;

  useEffect(() => {
    let mounted = true;
    let refreshTimeout: number | null = null;
    let isHandlingExpiry = false;

    const serviceTokenNames = tokens.filter(
      t => t !== NormalizedTokenName.AUTH_IDENTITY,
    );

    const gatewaySlot: TokenSlot = {
      tokenName: NormalizedTokenName.AUTH_IDENTITY,
      state: 'idle',
      retryPolicy: createRefreshRetryPolicy(),
      nextRetryAt: null,
    };

    const serviceSlots: TokenSlot[] = serviceTokenNames.map(tokenName => ({
      tokenName,
      state: 'idle' as TokenState,
      retryPolicy: createRefreshRetryPolicy(),
      nextRetryAt: null,
    }));

    const allSlots = [gatewaySlot, ...serviceSlots];

    function clearTimer() {
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
    }

    function getSlot(tokenName: NormalizedTokenNameType): TokenSlot | undefined {
      return allSlots.find(s => s.tokenName === tokenName);
    }

    function handleAuthSessionExpired() {
      if (isHandlingExpiry) return;
      isHandlingExpiry = true;
      try {
        clearTimer();
        clearAuthPresence();
        clearAllTokens();
        clearAuthSessionState();
      } finally {
        isHandlingExpiry = false;
      }
    }

    async function runRefreshCycle() {
      if (!mounted) return;

      // Phase 1: Gateway (AUTH_IDENTITY)
      const gatewayToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
      const gatewayExpMs = gatewayToken
        ? getTokenExpMs(NormalizedTokenName.AUTH_IDENTITY)
        : null;
      const gatewayNeedsRefresh =
        !gatewayToken || !gatewayExpMs || gatewayExpMs - REFRESH_BUFFER_MS <= Date.now();

      if (gatewayNeedsRefresh) {
        if (!gatewayToken && !hasAuthPresence()) {
          handleAuthSessionExpired();
          return;
        }

        const result = await refreshGateway();
        if (result === 'non-retryable') {
          handleAuthSessionExpired();
          return;
        }
        if (result === 'retryable') {
          const delayMs = gatewaySlot.retryPolicy.registerFailure();
          scheduleRefresh(delayMs);
          return;
        }
        gatewaySlot.state = 'managing';
        gatewaySlot.retryPolicy.reset();
      } else {
        gatewaySlot.state = 'managing';
      }

      if (!mounted) return;

      // Hydrate auth session state on first successful gateway confirmation
      if (useAuthSessionStore.getState().status === 'idle') {
        await hydrateAuthSessionState();
      }

      if (!mounted) return;

      // Phase 2: Service tokens (parallel, independent)
      const now = Date.now();
      const slotsToRefresh = serviceSlots.filter(slot => {
        if (slot.state === 'dormant') return false;
        if (slot.state === 'backoff' && slot.nextRetryAt && slot.nextRetryAt > now) {
          return false;
        }
        return isTokenExpiredOrMissing(slot.tokenName) || slot.state === 'backoff';
      });

      if (slotsToRefresh.length > 0) {
        await Promise.allSettled(
          slotsToRefresh.map(slot =>
            refreshServiceToken(slot, registryRef.current),
          ),
        );
      }

      // Mark healthy service tokens as managing
      for (const slot of serviceSlots) {
        if (
          slot.state === 'idle' &&
          !isTokenExpiredOrMissing(slot.tokenName)
        ) {
          slot.state = 'managing';
        }
      }

      // Schedule next cycle
      if (mounted) {
        const nextDelayMs = computeNextRefreshDelay();
        if (nextDelayMs !== null) {
          scheduleRefresh(nextDelayMs);
        }
      }
    }

    function computeNextRefreshDelay(): number | null {
      const now = Date.now();
      let earliest: number | null = null;

      for (const slot of allSlots) {
        // Check expiry-based refresh for managing tokens
        if (slot.state === 'managing') {
          const expMs = getTokenExpMs(slot.tokenName);
          if (expMs) {
            const delay = expMs - REFRESH_BUFFER_MS - now;
            if (delay > 0 && (earliest === null || delay < earliest)) {
              earliest = delay;
            }
          }
        }

        // Check retry delay for backoff tokens
        if (slot.state === 'backoff' && slot.nextRetryAt) {
          const delay = slot.nextRetryAt - now;
          if (delay > 0 && (earliest === null || delay < earliest)) {
            earliest = delay;
          } else if (delay <= 0) {
            // Retry is due now
            return 0;
          }
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
        if (slot.tokenName === NormalizedTokenName.AUTH_IDENTITY) {
          if (!hasAuthPresence()) {
            handleAuthSessionExpired();
          }
        }
        return;
      }

      // Token was written — reactivate if dormant or in backoff
      if (slot.state === 'dormant' || slot.state === 'backoff') {
        slot.state = 'idle';
        slot.retryPolicy.reset();
        slot.nextRetryAt = null;
        scheduleRefresh();
      }
    }

    // Cross-tab storage event handler
    function handleStorageEvent(event: StorageEvent) {
      if (!mounted) return;

      const strategy = getJwtTokenStrategy();
      const managedKeys = Object.values(strategy.storeKeyByToken).filter(Boolean);
      if (!managedKeys.includes(event.key ?? '')) return;

      if (event.newValue !== null) {
        for (const slot of allSlots) {
          if (slot.state === 'dormant' || slot.state === 'backoff') {
            const token = getToken(slot.tokenName);
            if (token) {
              slot.state = 'idle';
              slot.retryPolicy.reset();
              slot.nextRetryAt = null;
            }
          }
        }
        scheduleRefresh();
      } else {
        if (
          !getToken(NormalizedTokenName.AUTH_IDENTITY) &&
          !hasAuthPresence()
        ) {
          handleAuthSessionExpired();
        }
      }
    }

    // Visibility change handler
    function handleVisibilityChange() {
      if (document.visibilityState !== 'visible') return;
      if (!mounted) return;

      const needsRefresh = allSlots.some(
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
  }, [tokens, registry]);

  return null;
}
