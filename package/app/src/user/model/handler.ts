import {authApi} from '@rezics/api/auth/auth.api';
import {authKeys} from '@rezics/api/auth/auth.keys';
import {NormalizedTokenName} from '@rezics/contract';
import {
  clearAllTokens,
  ensureAuthIdentityToken,
  setToken,
} from '@rezics/api/react-query/jwt';
import {userKeys} from '@rezics/api/user/user.keys';
import {qc} from '@/app/provider/reactQueryUtil';
import {userApi} from '@rezics/api/user/user.api';
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
  useUserProfileStore,
} from '@/user/state';

/**
 * One-shot provisioning sequence for establishing a business session.
 * 1. Ensure AUTH_IDENTITY exists
 * 2. Fetch AUTH_CONTEXT (ephemeral, in memory only)
 * 3. Provision user on business server via ensure()
 * 4. Issue REZICS_SESSION
 * 5. Hydrate authSessionStore
 */
export async function establishBusinessSession() {
  await ensureAuthIdentityToken({requirePresence: false});

  const authContext = await authApi.getContextToken();
  const contextToken = authContext.token;

  const ensured = await userApi.ensure(contextToken);
  const sessionToken = (await userApi.issueSessionToken()).token;

  setToken(sessionToken, NormalizedTokenName.REZICS_SESSION);
  useAuthSessionStore.getState().syncBusinessToken(sessionToken);

  await hydrateAuthSessionState();
  useUserProfileStore.getState().setUser(ensured.user);

  return {user: ensured.user};
}

export const login = async (email: string, password: string) => {
  await authApi.signIn({email, password});
  const token = await ensureAuthIdentityToken({requirePresence: false});

  const sessionState = await hydrateAuthSessionState();
  const hasAuthSession = Boolean(sessionState?.session?.id);

  if (!token && !hasAuthSession) {
    throw new Error('Login failed');
  }

  const user = sessionState?.authSession.canAcquireMemberToken
    ? (await establishBusinessSession()).user
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
    await authApi.signUp({email, password});
    const token = await ensureAuthIdentityToken({requirePresence: false});

    const sessionState = await hydrateAuthSessionState();
    const hasAuthSession = Boolean(sessionState?.session?.id);

    if (!token && !hasAuthSession) {
      throw new Error('Registration failed');
    }

    const user = sessionState?.authSession.canAcquireMemberToken
      ? (await establishBusinessSession()).user
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
