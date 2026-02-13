import React, {useCallback, useEffect, useRef} from 'react';
import {
  getToken,
  parseJwt,
  refreshAuthToken,
} from '@package/api/react-query/http';

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
    const token = getToken();
    const payload = parseJwt(token);
    const expSeconds = payload?.exp;
    if (!expSeconds) return;

    const expMs = expSeconds * 1000;
    const now = Date.now();
    const msUntilRefresh = expMs - REFRESH_BUFFER_MS - now;

    console.log('msUntilRefresh=', msUntilRefresh);

    if (msUntilRefresh <= 0) {
      try {
        await refreshAuthToken();
      } catch {
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
      } catch {
        return;
      }
      if (isMountedRef.current) {
        void scheduleRefresh();
      }
    }, msUntilRefresh);
  }, [clearRefreshTimer]);

  useEffect(() => {
    isMountedRef.current = true;
    void scheduleRefresh();
    return () => {
      isMountedRef.current = false;
      clearRefreshTimer();
    };
  }, [clearRefreshTimer, scheduleRefresh]);

  return <div style={{display: 'none'}}>auth provider</div>;
}
