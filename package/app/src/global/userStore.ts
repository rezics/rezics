import {create} from 'zustand';
import {createJSONStorage, persist} from 'zustand/middleware';
import type {QueryClient} from '@tanstack/react-query';
import {userQueries} from '@/api/user/user.queries';
import {getToken} from '@/api/react-query/http';
import {userApi} from '@/api/user/user.api';
import type {UserDTO} from '@package/contract';

type PartialUserDTO = Partial<UserDTO> & Record<string, unknown>;

interface UserState {
  user: PartialUserDTO | null;
  isAuthenticated: boolean;

  setUser: (user: PartialUserDTO | null) => void;
  logout: () => void;
  init: () => Promise<void>;
}

/**
 * useUserStore - User store hook
 * Provides user data and authentication state
 * @returns {UserState} User state
 */
export const useUserStore = create<UserState>()(
  persist(
    (set, get) => ({
      // initial state
      user: null,
      isAuthenticated: false,

      // Actions
      setUser: user =>
        set({
          user,
          isAuthenticated: !!user,
        }),

      logout: () => {
        set({
          user: null,
          isAuthenticated: false,
        });
      },

      // lazy initialization: read from persist; if failed, request /users/me based on jwt_token
      init: async () => {
        if (typeof window === 'undefined') return;
        // 已有用户则跳过
        if (get().user) return;

        // try to read the original snapshot from persist (avoid waiting for rehydrate callback)
        try {
          const raw = localStorage.getItem('user-store');
          if (raw) {
            const parsed = JSON.parse(raw) as {
              state?: {user?: PartialUserDTO; isAuthenticated?: boolean};
            };
            const snapshotUser = parsed?.state?.user ?? null;
            const snapshotAuth = !!parsed?.state?.isAuthenticated;
            if (snapshotUser) {
              set({user: snapshotUser, isAuthenticated: snapshotAuth});
              return;
            }
          }
        } catch {
          // ignore local parsing failure, go to token branch
        }

        // if there is a token, fetch /users/me
        const token = getToken();
        if (!token) return;

        try {
          const qc: QueryClient | undefined = (window as any)
            ?.__TANSTACK_QUERY_CLIENT__;
          let dto: PartialUserDTO;
          if (qc) {
            dto = await qc.ensureQueryData(userQueries.me(''));
          } else {
            dto = await userApi.me();
          }

          const mapped: PartialUserDTO = {
            unitId: dto.unitId,
            name: dto.name,
            email: dto.email,
            avatar: dto.avatar,
          };
          set({user: mapped, isAuthenticated: true});
        } catch {
          // if fetching fails, keep the user as not authenticated
          set({user: null, isAuthenticated: false});
        }
      },
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

// do lazy initialization after module load (won't block UI)
queueMicrotask?.(() => {
  try {
    void useUserStore.getState().init();
  } catch {
    // ignore
  }
});
