import {authApi} from '@package/api/auth/auth.api';
import {authKeys} from '@package/api/auth/auth.keys';
import {NormalizedTokenName} from '@package/contract';
import {clearAllTokens, getToken, setToken} from '@package/api/react-query/jwt';
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

function clearMemberState() {
  setToken(null, NormalizedTokenName.AUTH_CONTEXT);
  setToken(null, NormalizedTokenName.REZICS_SESSION);
  useAuthSessionStore.getState().syncAuthContext(null);
  useAuthSessionStore.getState().syncBusinessToken(null);
  useUserProfileStore.getState().clearProfile();
}

async function ensureMemberAccess() {
  const authToken = getToken(NormalizedTokenName.AUTH_IDENTITY);
  const authContext = await authApi.getContextToken(authToken ?? undefined);
  setToken(authContext.token, NormalizedTokenName.AUTH_CONTEXT);
  useAuthSessionStore.getState().syncAuthContext(authContext.token);

  const sessionState = await hydrateAuthSessionState();
  const hasAuthSession = Boolean(sessionState?.session?.id);

  if (!hasAuthSession) {
    throw new Error('Authentication session unavailable');
  }

  if (
    authContext.claims.verificationStatus !== 'verified' ||
    !sessionState?.authSession.canAcquireMemberToken
  ) {
    clearMemberState();
    return {sessionState, user: null};
  }

  const ensured = await userApi.ensure();
  const sessionToken = (await userApi.issueSessionToken()).token;

  setToken(sessionToken, NormalizedTokenName.REZICS_SESSION);
  useAuthSessionStore.getState().syncBusinessToken(sessionToken);
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
  useAuthSessionStore.getState().syncAuthContext(null);
  useAuthSessionStore.getState().syncBusinessToken(null);
  clearAuthSessionState();
  useUserProfileStore.getState().clearProfile();
  qc.removeQueries({queryKey: authKeys.all()});
  qc.removeQueries({queryKey: userKeys.all()});
  if (typeof window === 'undefined') return;
  if (!disableReload) {
    setTimeout(() => location.reload(), 500);
  }
};
