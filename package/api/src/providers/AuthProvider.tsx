import {
  clearAuthPresence,
  hasAuthPresence,
} from "@rezics/api/react-query/authPresence";
import {
  AUTH_TOKEN_STORAGE_EVENT,
  clearAllTokens,
  exchangeForSessionToken,
  getJwtTokenStrategy,
  getToken,
  parseJwt,
  queryAccessToken,
} from "@rezics/api/react-query/jwt";
import { NormalizedTokenName } from "@rezics/contract";
import { useEffect } from "react";
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "../states/authSessionStore";
import { createRefreshRetryPolicy } from "./refreshRetryPolicy";

const REFRESH_BUFFER_MS = 60 * 1000;

function getTokenExpMs(tokenName: string): number | null {
  const token = getToken(tokenName as any);
  if (!token) return null;
  const payload = parseJwt(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

async function refreshAuthSession(): Promise<
  "success" | "retryable" | "non-retryable"
> {
  try {
    const token = await queryAccessToken({ requirePresence: true });
    return token ? "success" : "non-retryable";
  } catch {
    return "non-retryable";
  }
}

async function refreshSessionToken(): Promise<
  "success" | "retryable" | "non-retryable"
> {
  try {
    const token = await exchangeForSessionToken();
    return token ? "success" : "retryable";
  } catch {
    return "retryable";
  }
}

export function AuthProvider() {
  useEffect(() => {
    let mounted = true;
    let refreshTimeout: number | null = null;
    let isHandlingExpiry = false;

    const retryPolicy = createRefreshRetryPolicy();

    function clearTimer() {
      if (refreshTimeout !== null) {
        window.clearTimeout(refreshTimeout);
        refreshTimeout = null;
      }
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

      // 1. Refresh auth-session-token via session cookie
      const authToken = getToken(NormalizedTokenName.AUTH_SESSION);
      const authExpMs = authToken
        ? getTokenExpMs(NormalizedTokenName.AUTH_SESSION)
        : null;
      const authNeedsRefresh =
        !authToken || !authExpMs || authExpMs - REFRESH_BUFFER_MS <= Date.now();

      if (authNeedsRefresh) {
        if (!authToken && !hasAuthPresence()) {
          handleAuthSessionExpired();
          return;
        }

        const result = await refreshAuthSession();
        if (result === "non-retryable") {
          handleAuthSessionExpired();
          return;
        }
        if (result === "retryable") {
          const delayMs = retryPolicy.registerFailure();
          scheduleRefresh(delayMs);
          return;
        }
      }

      if (!mounted) return;

      // 2. Refresh rezics-session-token via exchange
      // Skip for unverified users — exchange always returns null for them
      const currentAuthClaims = parseJwt(
        getToken(NormalizedTokenName.AUTH_SESSION),
      );
      const isUnverified = currentAuthClaims?.email_verified === false;

      if (!isUnverified) {
        const sessionToken = getToken(NormalizedTokenName.REZICS_SESSION);
        const sessionExpMs = sessionToken
          ? getTokenExpMs(NormalizedTokenName.REZICS_SESSION)
          : null;
        const sessionNeedsRefresh =
          !sessionToken ||
          !sessionExpMs ||
          sessionExpMs - REFRESH_BUFFER_MS <= Date.now();

        if (sessionNeedsRefresh) {
          const result = await refreshSessionToken();
          if (result === "retryable") {
            const delayMs = retryPolicy.registerFailure();
            scheduleRefresh(delayMs);
            return;
          }
        }
      }

      retryPolicy.reset();

      if (!mounted) return;

      if (useAuthSessionStore.getState().status === "idle") {
        await hydrateAuthSessionState();
      }

      if (!mounted) return;

      // Schedule next refresh based on the sooner expiry
      const nextDelayMs = computeNextRefreshDelay();
      if (nextDelayMs !== null) {
        scheduleRefresh(nextDelayMs);
      }
    }

    function computeNextRefreshDelay(): number | null {
      const authExpMs = getTokenExpMs(NormalizedTokenName.AUTH_SESSION);
      const sessionExpMs = getTokenExpMs(NormalizedTokenName.REZICS_SESSION);

      const expiryTimes = [authExpMs, sessionExpMs].filter(
        (v): v is number => v !== null,
      );
      if (expiryTimes.length === 0) return null;

      const earliestExpiry = Math.min(...expiryTimes);
      const delay = earliestExpiry - REFRESH_BUFFER_MS - Date.now();
      return delay > 0 ? delay : 0;
    }

    function scheduleRefresh(delayMs = 0) {
      clearTimer();
      refreshTimeout = window.setTimeout(
        () => void runRefreshCycle(),
        Math.max(0, delayMs),
      );
    }

    function handleTokenStorageEvent(event: Event) {
      if (!mounted) return;

      const customEvent = event as CustomEvent<{
        token?: string | null;
        tokenName?: string;
      }>;
      const detail = customEvent.detail;

      if (!detail?.tokenName) return;

      if (detail.token === null) {
        if (
          detail.tokenName === NormalizedTokenName.AUTH_SESSION &&
          !hasAuthPresence()
        ) {
          handleAuthSessionExpired();
        }
        return;
      }

      scheduleRefresh();
    }

    function handleStorageEvent(event: StorageEvent) {
      if (!mounted) return;

      const strategy = getJwtTokenStrategy();
      const managedKeys = Object.values(strategy.storeKeyByToken).filter(
        Boolean,
      );
      if (!managedKeys.includes(event.key ?? "")) return;

      if (event.newValue !== null) {
        scheduleRefresh();
      } else {
        if (!getToken(NormalizedTokenName.AUTH_SESSION) && !hasAuthPresence()) {
          handleAuthSessionExpired();
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (!mounted) return;

      const sessionExpMs = getTokenExpMs(NormalizedTokenName.REZICS_SESSION);
      const authExpMs = getTokenExpMs(NormalizedTokenName.AUTH_SESSION);
      const now = Date.now();

      if (
        !sessionExpMs ||
        sessionExpMs - REFRESH_BUFFER_MS <= now ||
        !authExpMs ||
        authExpMs - REFRESH_BUFFER_MS <= now
      ) {
        scheduleRefresh();
      }
    }

    scheduleRefresh();

    window.addEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenStorageEvent);
    window.addEventListener("storage", handleStorageEvent);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimer();
      window.removeEventListener(
        AUTH_TOKEN_STORAGE_EVENT,
        handleTokenStorageEvent,
      );
      window.removeEventListener("storage", handleStorageEvent);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
