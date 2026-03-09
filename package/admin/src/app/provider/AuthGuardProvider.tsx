import {useEffect, useRef, useCallback} from 'react';
import {useRouter} from '@tanstack/react-router';

import {
  AUTH_TOKEN_STORAGE_EVENT,
  getToken,
} from '@package/api/react-query/http';

import {AUTH_STORE_KEY, useAuthStore} from '@package/app-shell';

function isTokenClearedEvent(event?: Event): boolean {
  if (!event) return false;

  if (event instanceof StorageEvent) {
    return event.key === AUTH_STORE_KEY && event.newValue === null;
  }

  if ('detail' in event) {
    const customEvent = event as CustomEvent<{token?: string | null}>;
    return customEvent.detail?.token === null;
  }

  return false;
}

export function AuthGuardProvider() {
  const router = useRouter();
  const isMountedRef = useRef(true);

  const checkAuth = useCallback(() => {
    const token = getToken();

    if (!token) {
      router.navigate({
        to: '/login',
        replace: true,
        search: {redirect: '/'},
      });
    }
  }, [router]);

  useEffect(() => {
    isMountedRef.current = true;

    useAuthStore.getState().syncFromStorage();

    const handleTokenChange = (event?: Event) => {
      useAuthStore.getState().syncFromStorage();

      if (isTokenClearedEvent(event)) {
        if (isMountedRef.current) {
          router.navigate({
            to: '/login',
            replace: true,
            search: {redirect: '/'},
          });
        }
        return;
      }

      checkAuth();
    };

    checkAuth();

    window.addEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenChange);
    window.addEventListener('storage', handleTokenChange);

    return () => {
      isMountedRef.current = false;

      window.removeEventListener(AUTH_TOKEN_STORAGE_EVENT, handleTokenChange);
      window.removeEventListener('storage', handleTokenChange);
    };
  }, [checkAuth, router]);

  return null;
}
