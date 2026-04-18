import { authApi } from "@rezics/api/auth/auth.api";
import { authKeys } from "@rezics/api/auth/auth.keys";
import {
  clearAllTokens,
  ensureAuthSessionToken,
  exchangeForSessionToken,
  parseJwt,
} from "@rezics/api/react-query/jwt";
import {
  clearAuthSessionState,
  hydrateAuthSessionState,
  useAuthSessionStore,
} from "@rezics/api/states";
import { userKeys } from "@rezics/api/user/user.keys";
import { qc } from "@/app/providers/reactQueryUtil";

/**
 * Admin login: sign in -> verify admin role -> exchange for session token -> hydrate.
 */
export async function adminLogin(email: string, password: string) {
  await authApi.signIn({ email, password });
  const authToken = await ensureAuthSessionToken({ requirePresence: false });

  const claims = parseJwt(authToken);
  if (!(claims?.role === "admin" || claims?.role === "owner")) {
    throw new Error("You are not authorized to access this page");
  }

  const sessionToken = await exchangeForSessionToken();
  if (!sessionToken) {
    throw new Error("Login failed: token exchange failed");
  }

  await hydrateAuthSessionState();

  return { token: sessionToken };
}

/**
 * Admin logout: sign out -> clear state -> reload.
 */
export async function adminLogout() {
  await authApi.signOut();
  clearAllTokens();
  useAuthSessionStore.getState().reset();
  clearAuthSessionState();
  qc.removeQueries({ queryKey: authKeys.all() });
  qc.removeQueries({ queryKey: userKeys.all() });
  if (typeof window !== "undefined") {
    setTimeout(() => location.reload(), 500);
  }
}
