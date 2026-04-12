import {
  clearAuthPresence,
  hasAuthPresence,
} from "@rezics/api/react-query/authPresence";
import {
  AUTH_TOKEN_STORAGE_EVENT,
  clearAllTokens,
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
} from "../state/authSessionStore";
import { createRefreshRetryPolicy } from "./refreshRetryPolicy";

const REFRESH_BUFFER_MS = 60 * 1000;

function getTokenExpMs(): number | null {
  const token = getToken(NormalizedTokenName.AUTH_IDENTITY);
  if (!token) return null;
  const payload = parseJwt(token);
  return payload?.exp ? payload.exp * 1000 : null;
}

async function refreshGateway(): Promise<
  "success" | "retryable" | "non-retryable"
> {
  try {
    const token = await queryAccessToken({ requirePresence: true });
    return token ? "success" : "non-retryable";
  } catch {
    return "non-retryable";
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

      const gatewayToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
      const gatewayExpMs = gatewayToken ? getTokenExpMs() : null;
      const gatewayNeedsRefresh =
        !gatewayToken ||
        !gatewayExpMs ||
        gatewayExpMs - REFRESH_BUFFER_MS <= Date.now();

      if (gatewayNeedsRefresh) {
        if (!gatewayToken && !hasAuthPresence()) {
          handleAuthSessionExpired();
          return;
        }

        const result = await refreshGateway();
        if (result === "non-retryable") {
          handleAuthSessionExpired();
          return;
        }
        if (result === "retryable") {
          const delayMs = retryPolicy.registerFailure();
          scheduleRefresh(delayMs);
          return;
        }
        retryPolicy.reset();
      }

      if (!mounted) return;

      if (useAuthSessionStore.getState().status === "idle") {
        await hydrateAuthSessionState();
      }

      if (!mounted) return;

      const nextDelayMs = computeNextRefreshDelay();
      if (nextDelayMs !== null) {
        scheduleRefresh(nextDelayMs);
      }
    }

    function computeNextRefreshDelay(): number | null {
      const expMs = getTokenExpMs();
      if (!expMs) return null;
      const delay = expMs - REFRESH_BUFFER_MS - Date.now();
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
      if (detail.tokenName !== NormalizedTokenName.AUTH_IDENTITY) return;

      if (detail.token === null) {
        if (!hasAuthPresence()) {
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
        if (
          !getToken(NormalizedTokenName.AUTH_IDENTITY) &&
          !hasAuthPresence()
        ) {
          handleAuthSessionExpired();
        }
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (!mounted) return;

      const expMs = getTokenExpMs();
      if (!expMs || expMs - REFRESH_BUFFER_MS <= Date.now()) {
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
