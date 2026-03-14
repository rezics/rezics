import {authApi} from '@package/api/auth/auth.api';
import {authKeys} from '@package/api/auth/auth.keys';
import {NormalizedTokenName} from '@package/contract';
import {clearAllTokens, setToken} from '@package/api/react-query/jwt';
import {userKeys} from '@package/api/user/user.keys';
import {qc} from '@/app/provider/reactQueryUtil';
import {userApi} from '@package/api/user/user.api';
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
  useAuthStore,
  useUserProfileStore,
} from '@/user/state';

async function ensureMemberAccess() {
  const sessionState = await hydrateAuthSessionState();
  const hasAuthSession = Boolean(sessionState?.session?.id);

  if (!hasAuthSession) {
    throw new Error('Authentication session unavailable');
  }

  if (!sessionState?.authSession.canAcquireMemberToken) {
    setToken(null, NormalizedTokenName.REZICS_SESSION);
    useAuthSessionStore.getState().syncBusinessToken(null);
    useUserProfileStore.getState().clearProfile();
    return {sessionState, user: null};
  }

  const ensured = await userApi.ensure();
  if (!ensured.sessionToken) {
    throw new Error('Failed to acquire rezics session token');
  }

  setToken(ensured.sessionToken, NormalizedTokenName.REZICS_SESSION);
  useAuthSessionStore.getState().syncBusinessToken(ensured.sessionToken);
  useUserProfileStore.getState().setUser(ensured.user);

  return {
    sessionState,
    user: ensured.user,
  };
}

export async function acquireMemberAccessIfReady() {
  return ensureMemberAccess();
}

export const login = async (email: string, password: string) => {
  const result = await authApi.signIn({email, password});
  const token = result.token ?? result.session?.token ?? null;
  if (token) {
    useAuthStore.getState().setToken(token);
  } else {
    useAuthStore.getState().clearAuth();
  }

  const sessionState = await hydrateAuthSessionState();
  const hasAuthSession = Boolean(sessionState?.session?.id);

  if (!token && !hasAuthSession) {
    throw new Error('Login failed');
  }

  const user = sessionState?.authSession.canAcquireMemberToken
    ? (await ensureMemberAccess()).user
    : null;

  return {user, token};
};

export const register = async (
  email: string,
  password: string,
  avatar?: string,
  bio?: string,
) => {
  try {
    void avatar;
    void bio;
    const result = await authApi.signUp({
      email,
      password,
    });
    const token = result.token ?? result.session?.token ?? null;
    if (token) {
      useAuthStore.getState().setToken(token);
    } else {
      useAuthStore.getState().clearAuth();
    }

    const sessionState = await hydrateAuthSessionState();
    const hasAuthSession = Boolean(sessionState?.session?.id);

    if (!token && !hasAuthSession) {
      throw new Error('Registration failed');
    }

    const user = sessionState?.authSession.canAcquireMemberToken
      ? (await ensureMemberAccess()).user
      : null;

    return {user, token};
  } catch (error) {
    console.error('Error during registration:', error);
    throw error;
  }
};

export const logout = async (disableReload = false) => {
  await authApi.signOut();
  clearAllTokens();
  useAuthStore.getState().clearAuth();
  clearAuthSessionState();
  useUserProfileStore.getState().clearProfile();
  qc.removeQueries({queryKey: authKeys.all()});
  qc.removeQueries({queryKey: userKeys.all()});
  if (typeof window === 'undefined') return;
  if (!disableReload) {
    setTimeout(() => location.reload(), 500);
  }
};
