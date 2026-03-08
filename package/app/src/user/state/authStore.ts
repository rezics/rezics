import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import {devtools} from 'zustand/middleware';

export type AuthStoreState = {
  accessToken: string | null;
  isAuthenticated: boolean;
  setToken: (token: string | null) => void;
  clearAuth: () => void;
  init: () => void;
};

type PersistedAuthSnapshot = {
  state?: {
    accessToken?: string | null;
    isAuthenticated?: boolean;
  };
};

export const AUTH_STORE_KEY = 'auth-store';

export const useAuthStore = create<AuthStoreState>()(
  devtools(
    persist(
      set => ({
        accessToken: null,
        isAuthenticated: false,
        setToken: token =>
          set({
            accessToken: token,
            isAuthenticated: !!token,
          }),
        clearAuth: () =>
          set({
            accessToken: null,
            isAuthenticated: false,
          }),
        init: () => {
          if (typeof window === 'undefined') return;

          try {
            const raw = localStorage.getItem(AUTH_STORE_KEY);
            if (!raw) return;

            const parsed = JSON.parse(raw) as PersistedAuthSnapshot;
            const accessToken = parsed?.state?.accessToken ?? null;
            set({
              accessToken,
              isAuthenticated: !!accessToken,
            });
          } catch {
            set({
              accessToken: null,
              isAuthenticated: false,
            });
          }
        },
      }),
      {
        name: AUTH_STORE_KEY,
        storage: createJSONStorage(() => localStorage),
      },
    ),
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
