import {
  getToken,
  removeToken,
  setToken as persistToken,
  parseJwt,
} from '@package/api/react-query/jwt';
import {NormalizedTokenName} from '@package/contract';
import {create} from 'zustand';
import {devtools} from 'zustand/middleware';

export type AuthStoreState = {
  accessToken: string | null;
  isAuthenticated: boolean;
  id: string | null;
  slug: string | null;
  role: string | null;
  setToken: (token: string | null) => void;
  clearAuth: () => void;
  syncFromStorage: () => void;
  init: () => void;
};

export const AUTH_STORE_KEY = 'auth-store';

function toState(token: string | null) {
  const payload = parseJwt(token);
  return {
    accessToken: token,
    isAuthenticated: !!token,
    id: payload?.id ?? null,
    slug: payload?.slug ?? null,
    role: payload?.role ?? null,
  };
}

export const useAuthStore = create<AuthStoreState>()(
  devtools(
    set => ({
      ...toState(getToken(NormalizedTokenName.AUTH_IDENTITY)),
      setToken: token => {
        persistToken(token, NormalizedTokenName.AUTH_IDENTITY);
        set(toState(token));
      },
      clearAuth: () => {
        removeToken(NormalizedTokenName.AUTH_IDENTITY);
        set(toState(null));
      },
      syncFromStorage: () =>
        set(toState(getToken(NormalizedTokenName.AUTH_IDENTITY))),
      init: () => set(toState(getToken(NormalizedTokenName.AUTH_IDENTITY))),
    }),
    {name: 'authStore', store: 'authStore'},
  ),
);

queueMicrotask?.(() => {
  try {
    useAuthStore.getState().init();
  } catch {
    // ignore
  }
});
