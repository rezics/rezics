import {
  clearAuthPresence,
  hasAuthPresence,
} from "@rezics/api/react-query/authPresence";
import {
  clearAllTokens,
  exchangeForSessionToken,
} from "@rezics/api/react-query/jwt";
import { useEffect } from "react";
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "../states/authSessionStore";
import { createRefreshRetryPolicy } from "./refreshRetryPolicy";

async function refreshSessionToken(): Promise<
  "success" | "retryable" | "non-retryable"
> {
  try {
    const refreshed = await exchangeForSessionToken();
    return refreshed ? "success" : "non-retryable";
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

      if (!hasAuthPresence()) {
        handleAuthSessionExpired();
        return;
      }

      const result = await refreshSessionToken();
      if (result === "retryable") {
        const delayMs = retryPolicy.registerFailure();
        scheduleRefresh(delayMs);
        return;
      }

      retryPolicy.reset();

      if (!mounted) return;

      await hydrateAuthSessionState();

      if (!mounted) return;

      scheduleRefresh(5 * 60 * 1000);
    }

    function scheduleRefresh(delayMs = 0) {
      clearTimer();
      refreshTimeout = window.setTimeout(
        () => void runRefreshCycle(),
        Math.max(0, delayMs),
      );
    }

    function handleVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      if (!mounted) return;
      scheduleRefresh();
    }

    scheduleRefresh();

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      clearTimer();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
