import type {AuthSession, AuthUser, GetSessionStateResponse} from '@package/contract';
import {authApi} from '@package/api/auth/auth.api';
import {getToken} from '@package/api/react-query/jwt';
import {create} from 'zustand';
import {devtools} from 'zustand/middleware';

export type AuthCapabilityLevel = 'anonymous' | 'guest' | 'member';
export type AuthSessionHydrationStatus = 'idle' | 'loading' | 'ready' | 'error';

type AuthSessionSnapshot = Pick<GetSessionStateResponse, 'session' | 'user' | 'authSession'>;

export type AuthSessionStoreState = {
  status: AuthSessionHydrationStatus;
  session: AuthSession | null;
  user: AuthUser | null;
  authSession: GetSessionStateResponse['authSession'] | null;
  hasAuthSession: boolean;
  hasBusinessToken: boolean;
  capabilityLevel: AuthCapabilityLevel;
  needsVerification: boolean;
  needsOnboarding: boolean;
  error: string | null;
  setPending: () => void;
  setSessionState: (state: AuthSessionSnapshot | null) => void;
  syncBusinessToken: (token: string | null) => void;
  clearSessionState: () => void;
};

function deriveState(
  snapshot: AuthSessionSnapshot | null,
  token: string | null,
  status: AuthSessionHydrationStatus = 'ready',
  error: string | null = null,
) {
  const hasAuthSession = Boolean(snapshot?.session?.id && snapshot?.user?.id);
  const hasBusinessToken = Boolean(token);
  const needsVerification = Boolean(snapshot?.authSession?.needsEmailVerification);
  const needsOnboarding = Boolean(snapshot?.authSession?.needsOnboarding);

  let capabilityLevel: AuthCapabilityLevel = 'anonymous';
  if (hasAuthSession) {
    capabilityLevel = hasBusinessToken ? 'member' : 'guest';
  }

  return {
    status,
    session: snapshot?.session ?? null,
    user: snapshot?.user ?? null,
    authSession: snapshot?.authSession ?? null,
    hasAuthSession,
    hasBusinessToken,
    capabilityLevel,
    needsVerification,
    needsOnboarding,
    error,
  };
}

export const useAuthSessionStore = create<AuthSessionStoreState>()(
  devtools(
    set => ({
      ...deriveState(null, getToken(), 'idle'),
      setPending: () =>
        set(state => ({
          ...state,
          status: 'loading',
          error: null,
        })),
      setSessionState: state =>
        set(deriveState(state, getToken(), 'ready')),
      syncBusinessToken: token =>
        set(state =>
          deriveState(
            state.session && state.user && state.authSession
              ? {
                  session: state.session,
                  user: state.user,
                  authSession: state.authSession,
                }
              : null,
            token,
            state.status === 'idle' ? 'ready' : state.status,
            state.error,
          ),
        ),
      clearSessionState: () => set(deriveState(null, getToken(), 'ready')),
    }),
    {name: 'authSessionStore', store: 'authSessionStore'},
  ),
);

export async function hydrateAuthSessionState() {
  const store = useAuthSessionStore.getState();
  store.setPending();
  store.syncBusinessToken(getToken());

  try {
    const sessionState = await authApi.getSessionState();
    useAuthSessionStore.getState().setSessionState(sessionState);
    return sessionState;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown auth session error';
    useAuthSessionStore.setState(deriveState(null, getToken(), 'error', message));
    return null;
  }
}

export function clearAuthSessionState() {
  useAuthSessionStore.getState().clearSessionState();
}
