import {authApi} from '@package/api/auth/auth.api';
import {authKeys} from '@package/api/auth/auth.keys';
import {NormalizedTokenName} from '@package/contract';
import {
  clearAllTokens,
  ensureAuthIdentityToken,
  parseJwt,
  setToken,
} from '@package/api/react-query/jwt';
import {userKeys} from '@package/api/user/user.keys';
import {userApi} from '@package/api/user/user.api';
import {qc} from '@/app/provider/reactQueryUtil';
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from '@package/app-shell';

/**
 * Provision business session: AUTH_IDENTITY -> context token -> ensure user -> REZICS_SESSION.
 */
export async function establishBusinessSession() {
  await ensureAuthIdentityToken({requirePresence: false});

  const authContext = await authApi.getContextToken();
  const contextToken = authContext.token;

  await userApi.ensure(contextToken);
  const sessionToken = (await userApi.issueSessionToken()).token;

  setToken(sessionToken, NormalizedTokenName.REZICS_SESSION);
  useAuthSessionStore.getState().syncBusinessToken(sessionToken);

  await hydrateAuthSessionState();
}

/**
 * Admin login: sign in -> verify admin role -> hydrate session -> fire-and-forget business session.
 */
export async function adminLogin(email: string, password: string) {
  await authApi.signIn({email, password});
  const token = await ensureAuthIdentityToken({requirePresence: false});

  const claims = parseJwt(token);
  if (!(claims?.role === 'admin' || claims?.role === 'owner')) {
    throw new Error('You are not authorized to access this page');
  }

  await hydrateAuthSessionState();

  // Fire-and-forget: don't block admin access on business session
  establishBusinessSession().catch(() => {});

  return {token};
}

/**
 * Admin logout: sign out -> clear state -> reload.
 */
export async function adminLogout() {
  await authApi.signOut();
  clearAllTokens();
  useAuthSessionStore.getState().syncBusinessToken(null);
  clearAuthSessionState();
  qc.removeQueries({queryKey: authKeys.all()});
  qc.removeQueries({queryKey: userKeys.all()});
  if (typeof window !== 'undefined') {
    setTimeout(() => location.reload(), 500);
  }
}
